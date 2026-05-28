"""Siembra ~20 perfiles de demo distribuidos en 4 comunas chilenas.

Cada perfil:
- Username 'demo_*' (para poder limpiarlo con --clean sin tocar reales).
- KYC verificado con verified_at reciente (trial activo).
- 1-3 fotos (caras AI-generadas desde thispersondoesnotexist.com con fallback
  a placeholder colorido si la API no responde).
- 3-6 etiquetas mezcladas de servicios/extras/características.
- ~60% tiene anuncio activo con plan random.
- ~50% tiene 1-3 reseñas aprobadas.

Uso:
    python manage.py seed_demo
    python manage.py seed_demo --clean    # borra demos previos primero
"""

from __future__ import annotations

import random
import secrets
import urllib.request
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from apps.media_content.models import MediaContent
from apps.profiles.models import City, ModelProfile, Service
from apps.publications.models import Publication, SubscriptionPlan
from apps.reviews.models import Review
from core.image_processing import process_image

User = get_user_model()

FEMALE_NAMES = [
    "Sofía", "Camila", "Valentina", "Antonia", "Florencia",
    "Catalina", "Isidora", "Martina", "Constanza", "Javiera",
    "Trinidad", "Magdalena", "Daniela", "Fernanda", "Paula",
    "Laura", "Andrea", "Ignacia", "Renata", "Almendra",
    "Belén", "Maite", "Amanda", "Emilia", "Rocío",
]
TRANS_NAMES = [
    "Bianca", "Estefanía", "Roxana", "Karla", "Mía",
    "Romina", "Alessia", "Salomé",
]
MALE_NAMES = [
    "Mateo", "Joaquín", "Tomás", "Diego", "Cristóbal",
    "Vicente", "Benjamín", "Lucas",
]
# Distribución por género dentro de cada ciudad:
# 70% mujeres, 20% trans, 10% hombres.
GENDER_WEIGHTS = [
    ("female", FEMALE_NAMES, 0.70),
    ("trans", TRANS_NAMES, 0.20),
    ("male", MALE_NAMES, 0.10),
]

DESCRIPTIONS = [
    "Hola amor, soy una chica dulce y cariñosa que sabe cómo hacerte pasar un buen momento. Atención de calidad, sin apuros, en ambiente discreto y cómodo.",
    "Joven independiente con lugar propio, total discreción. Atención personalizada, sin afán. Me encanta que disfrutes y vuelvas por más.",
    "Soy nueva en la ciudad, busco caballeros respetuosos que valoren el buen trato. Servicios variados, hablamos sin compromiso.",
    "Modelo profesional, fotos 100% reales y actuales. Disponibilidad horario amplio, también salidas a hoteles previo acuerdo.",
    "Chica simpática, sociable y muy bien cuidada. Me preocupo de cada detalle para que la pases excelente. Llámame y conversemos.",
    "Atención exclusiva, lugar privado climatizado. Acepto parejas previa coordinación. Soy real, no pierdas tiempo con perfiles falsos.",
    "Hola, soy una mujer madura con experiencia, busco encuentros agradables sin compromiso. Lugar discreto en buen sector.",
    "Joven universitaria, atiendo en mis ratos libres. Trato cálido, conversación amena y momento inolvidable garantizado.",
    "Soy una chica liberal, sin tabúes, abierta a propuestas y nuevas experiencias. Total privacidad y respeto mutuo.",
    "Atención de lunes a viernes, también fines de semana coordinando con anticipación. Soy sincera, lo que ves en las fotos es lo que vas a encontrar.",
]

# Mensajes para reviews (en CL).
REVIEW_COMMENTS = [
    "Excelente atención, súper recomendada.",
    "Muy buena experiencia, repetiría sin dudar.",
    "Tal cual las fotos, trato amable.",
    "Buen servicio, lugar limpio y discreto.",
    "Linda persona, conversa rico. Volveré.",
    "Cumplió lo prometido, sin sorpresas.",
    "Muy puntual y cariñosa, 10/10.",
    "Atención de primera, ambiente muy cómodo.",
]

CITY_DISTRIBUTION = {
    "calama":         8,
    "santiago":       5,
    "vina-del-mar":   4,
    "concepcion":     3,
}


def _stylized_avatar(stage_name: str, variant: int = 0) -> bytes:
    """Genera un avatar estilizado: gradiente + inicial.

    Por construcción no representa a ninguna persona real; sirve para validar
    UI (tarjetas, galería, layout) sin entrar en problemas de copyright,
    identidad ni ambigüedad de edad.
    """
    W, H = 1200, 1200
    # Color base estable por nombre (mismo perfil = mismo color en todas sus fotos)
    seed = sum(ord(c) for c in stage_name) + variant * 17
    rng = random.Random(seed)
    h1 = (rng.randint(0, 360))
    h2 = (h1 + rng.choice([30, 50, 90, 180, 270])) % 360

    # Convertir HSL → RGB con saturación y luminosidad razonables
    def hsl_to_rgb(h, s=0.55, l=0.45):
        import colorsys
        r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
        return (int(r * 255), int(g * 255), int(b * 255))

    c1 = hsl_to_rgb(h1, s=0.55, l=0.30)
    c2 = hsl_to_rgb(h2, s=0.60, l=0.55)

    # Gradiente diagonal
    img = Image.new("RGB", (W, H), c1)
    for y in range(H):
        t = y / H
        r = int(c1[0] * (1 - t) + c2[0] * t)
        g = int(c1[1] * (1 - t) + c2[1] * t)
        b = int(c1[2] * (1 - t) + c2[2] * t)
        ImageDraw.Draw(img).line([(0, y), (W, y)], fill=(r, g, b))

    # Capa: círculo central con la inicial
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy, R = W // 2, H // 2, 380
    draw.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(255, 255, 255, 30))

    initial = stage_name[:1].upper() or "?"
    # Tamaño de fuente grande
    font = None
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ):
        try:
            font = ImageFont.truetype(path, 480)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), initial, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (cx - tw // 2 - bbox[0], cy - th // 2 - bbox[1] - 30),
        initial,
        font=font,
        fill=(255, 255, 255, 240),
    )

    # Etiqueta inferior de demo
    small_font = None
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        try:
            small_font = ImageFont.truetype(path, 38)
            break
        except OSError:
            continue
    if small_font:
        label = "PERFIL DEMO"
        bbox = draw.textbbox((0, 0), label, font=small_font)
        tw = bbox[2] - bbox[0]
        draw.text(
            ((W - tw) // 2, H - 100),
            label,
            font=small_font,
            fill=(255, 255, 255, 180),
        )

    buf = BytesIO()
    img.save(buf, "JPEG", quality=88, optimize=True)
    return buf.getvalue()


class Command(BaseCommand):
    help = "Siembra perfiles de demo distribuidos en varias comunas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean", action="store_true",
            help="Elimina users con username 'demo_*' antes de sembrar.",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            removed, _ = User.objects.filter(username__startswith="demo_").delete()
            self.stdout.write(self.style.WARNING(f"Demos previos eliminados: {removed} filas."))

        # Catálogos base. Si los hay vacíos avisamos y abortamos.
        services_qs = Service.objects.filter(category="service")
        extras_qs = Service.objects.filter(category="extra")
        features_qs = Service.objects.filter(category="feature")
        plans_qs = SubscriptionPlan.objects.filter(is_active=True)
        if not (services_qs.exists() and extras_qs.exists() and features_qs.exists()):
            self.stdout.write(self.style.ERROR(
                "Faltan etiquetas. Corre `seed_tags` antes."
            ))
            return
        if not plans_qs.exists():
            self.stdout.write(self.style.ERROR(
                "No hay planes. Corre `seed_plans` antes."
            ))
            return

        # Clientes para dejar reseñas (idempotente).
        clients = []
        for i in range(8):
            u, _ = User.objects.get_or_create(
                username=f"demo_cliente_{i}",
                defaults={
                    "email": f"demo_cliente_{i}@example.com",
                    "role": "client",
                    "email_verified": True,
                },
            )
            u.email_verified = True; u.role = "client"; u.save()
            clients.append(u)

        # Set de nombres ya usados para evitar slugs duplicados.
        used_names: set[str] = set(ModelProfile.objects.values_list("stage_name", flat=True))
        total_created = 0

        for city_slug, count in CITY_DISTRIBUTION.items():
            city = City.objects.filter(slug=city_slug).first()
            if not city:
                self.stdout.write(self.style.WARNING(f"Comuna '{city_slug}' no existe. Saltando."))
                continue

            for i in range(count):
                # Elegir género ponderado y un nombre coherente.
                gender = random.choices(
                    [g for g, _, _ in GENDER_WEIGHTS],
                    weights=[w for _, _, w in GENDER_WEIGHTS],
                )[0]
                pool = next(names for g, names, _ in GENDER_WEIGHTS if g == gender)
                for _ in range(50):
                    name = random.choice(pool)
                    if name not in used_names:
                        break
                else:
                    name = f"Modelo {secrets.token_hex(2)}"
                used_names.add(name)

                username = f"demo_{city_slug}_{i}_{secrets.token_hex(2)}"
                user = User.objects.create_user(
                    username=username,
                    email=f"{username}@example.com",
                    password=secrets.token_urlsafe(12),
                    role="model",
                )
                verified_at = timezone.now() - timedelta(hours=random.randint(0, 18))
                profile = ModelProfile.objects.create(
                    user=user,
                    stage_name=name,
                    gender=gender,
                    age=random.randint(22, 38),
                    description=random.choice(DESCRIPTIONS),
                    base_rate=random.choice([60_000, 80_000, 100_000, 120_000, 150_000, 180_000]),
                    city=city,
                    whatsapp=f"569{random.randint(10_000_000, 99_999_999)}",
                    telegram=random.choice([
                        "", "", "",  # mayoría sin telegram
                        f"{name.lower().replace(' ', '')}_chile",
                    ]),
                    verification_status=ModelProfile.VerificationStatus.VERIFIED,
                    verified_at=verified_at,
                )

                # Etiquetas: 2-4 servicios, 0-3 extras, 1-4 características.
                profile.services.add(*random.sample(list(services_qs), k=random.randint(2, 4)))
                if extras_qs.exists():
                    profile.services.add(*random.sample(list(extras_qs), k=random.randint(0, 3)))
                profile.services.add(*random.sample(list(features_qs), k=random.randint(1, 4)))

                # 1-3 fotos: avatares estilizados (gradiente + inicial),
                # mismo color base por perfil, leves variaciones por foto.
                for variant in range(random.randint(1, 3)):
                    raw = _stylized_avatar(name, variant=variant)
                    processed = process_image(raw, filename_stem="demo")
                    m = MediaContent(profile=profile, media_type="photo")
                    m.file.save(processed.name, processed, save=False)
                    m.save()

                # ~60% con anuncio activo destacado o no.
                if random.random() < 0.6:
                    plan = random.choice(list(plans_qs))
                    Publication.objects.create(
                        profile=profile,
                        plan=plan,
                        title=random.choice([
                            "Atención de calidad", "Ven a conocerme",
                            "Disponible ahora", "Anuncio destacado",
                            "Servicios exclusivos", "Total discreción",
                        ]),
                        is_featured=plan.includes_featured or random.random() < 0.2,
                        status=Publication.Status.ACTIVE,
                        expires_at=timezone.now() + timedelta(days=plan.duration_days),
                    )

                # ~50% con reseñas.
                if random.random() < 0.5:
                    for client in random.sample(clients, k=random.randint(1, min(4, len(clients)))):
                        Review.objects.create(
                            profile=profile,
                            client=client,
                            rating=random.choices([3, 4, 5], weights=[1, 3, 5])[0],
                            comment=random.choice(REVIEW_COMMENTS),
                            status=Review.Status.APPROVED,
                        )

                total_created += 1
                self.stdout.write(f"  ✓ {name:14} en {city.name:18} ({total_created})")

        self.stdout.write(self.style.SUCCESS(f"\n{total_created} perfiles demo creados."))

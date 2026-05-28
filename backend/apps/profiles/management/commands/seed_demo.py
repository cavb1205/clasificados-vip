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


def _fetch_face_image(timeout: int = 12) -> bytes:
    """Trae una cara AI-generada o devuelve un placeholder colorido."""
    try:
        req = urllib.request.Request(
            "https://thispersondoesnotexist.com/",
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
                "Accept": "image/jpeg,image/png,*/*",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            if len(data) > 5_000 and data[:3] == b"\xff\xd8\xff":
                return data
    except Exception:
        pass
    # Fallback: placeholder de color sólido con un círculo.
    img = Image.new("RGB", (800, 800), (
        random.randint(60, 180),
        random.randint(60, 180),
        random.randint(80, 200),
    ))
    draw = ImageDraw.Draw(img)
    draw.ellipse([200, 200, 600, 600], fill=(
        random.randint(180, 240),
        random.randint(180, 240),
        random.randint(200, 250),
    ))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=85)
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
                # Nombre único.
                for _ in range(50):
                    name = random.choice(FEMALE_NAMES)
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

                # 1-3 fotos.
                for _ in range(random.randint(1, 3)):
                    raw = _fetch_face_image()
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

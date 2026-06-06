"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, dashboard } from "@/lib/client-api";
import { toast } from "@/components/Toaster";
import { PlanPicker } from "@/components/PlanPicker";
import type { Plan } from "@/lib/types";

const MAX_IMG_MB = 10;
const MAX_VIDEO_MB = 50;

interface ProfileLite {
  id: number;
  stage_name: string;
  gender: "female" | "trans" | "male";
  age: number;
  city: { id: number; region?: { slug: string } } | null;
  whatsapp: string;
  telegram: string;
  description: string;
  base_rate: number | null;
  avatar: string | null;
  verification_status: "pending" | "verified" | "rejected";
  latest_verification: { status: string } | null;
}
interface Opt { id: number; name: string; slug: string }
interface MediaItem { id: number; media_type: "photo" | "video"; file_url: string }
interface Pub { id: number; title: string; status: string }

const STEPS = ["Bienvenida", "Tu perfil", "Tu identidad", "Tus fotos", "Tu anuncio", "¡Listo!"];

export default function OnboardingWizard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [regions, setRegions] = useState<Opt[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const reload = useCallback(async () => {
    const [p, m, pub] = await Promise.all([
      dashboard.getProfile() as Promise<ProfileLite[]>,
      dashboard.listMedia().catch(() => []) as Promise<MediaItem[]>,
      dashboard.listPublications().catch(() => []) as Promise<Pub[]>,
    ]);
    setProfile(p[0] ?? null);
    setMedia(m);
    setPubs(pub);
    return { profile: p[0] ?? null, media: m, pubs: pub };
  }, []);

  useEffect(() => {
    auth
      .me()
      .then((me) => {
        if ((me as { role?: string }).role !== "model") {
          router.replace("/");
          return Promise.reject(new Error("redirect"));
        }
        return Promise.all([
          reload(),
          dashboard.regions() as Promise<Opt[]>,
          dashboard.plans() as Promise<Plan[]>,
        ]);
      })
      .then(([state, r, pl]) => {
        setRegions(r);
        setPlans(pl);
        const { profile: p, media: m, pubs: pub } = state;
        // Arranca en el primer paso incompleto (según datos recién traídos).
        if (!p || !p.stage_name) setStep(1);
        else if (!p.latest_verification) setStep(2);
        else if (!p.avatar && m.filter((x) => x.media_type === "photo").length === 0) setStep(3);
        else if (pub.length === 0) setStep(4);
        else setStep(0);
        setReady(true);
      })
      .catch((e) => {
        if (e instanceof Error && e.message === "redirect") return;
        router.replace("/login?next=/dashboard/inicio");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!ready) return <p className="text-neutral-400">Cargando…</p>;

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Stepper step={step} />

      {step === 0 && <WelcomeStep onNext={() => go(1)} />}
      {step === 1 && (
        <ProfileStep
          profile={profile}
          regions={regions}
          onSaved={async () => { await reload(); go(2); }}
        />
      )}
      {step === 2 && (
        <KycStep
          submitted={!!profile?.latest_verification}
          status={profile?.latest_verification?.status}
          onDone={async () => { await reload(); go(3); }}
          onSkip={() => go(3)}
        />
      )}
      {step === 3 && (
        <PhotosStep
          avatar={profile?.avatar ?? null}
          photos={media.filter((m) => m.media_type === "photo")}
          onChange={reload}
          onNext={() => go(4)}
        />
      )}
      {step === 4 && (
        <AdStep plans={plans} pubs={pubs} onChange={reload} onNext={() => go(5)} />
      )}
      {step === 5 && <DoneStep profile={profile} />}

      {step > 0 && step < 5 && (
        <div className="flex justify-between pt-2 text-sm">
          <button onClick={() => go(step - 1)} className="rounded-full border border-neutral-700 px-4 py-2 text-neutral-300 hover:border-pink-500">
            ← Atrás
          </button>
          <Link href="/dashboard" className="self-center text-neutral-500 hover:text-pink-400">
            Saltar e ir a mi panel
          </Link>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-pink-500" : "bg-neutral-800"}`} />
        ))}
      </div>
      <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
        Paso {step + 1} de {STEPS.length} · {STEPS[step]}
      </p>
    </div>
  );
}

function Card({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {intro && <p className="mt-1 text-sm text-neutral-400">{intro}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-base outline-none focus:border-pink-500";

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <Card title="¡Bienvenida! 👋" intro="En 4 pasos quedas lista y visible. Te guiamos en cada uno; toma unos minutos.">
      <ol className="space-y-3 text-sm">
        {[
          ["1", "Tu perfil", "Nombre, ciudad y cómo te contactan."],
          ["2", "Tu identidad", "Subes tu cédula, una selfie y un video corto. Es privado y obligatorio para publicar."],
          ["3", "Tus fotos", "Tu foto principal y las fotos de tu muro."],
          ["4", "Tu anuncio", "Creas tu anuncio. Apenas verifiquemos tu identidad, quedas visible gratis durante tu periodo de prueba."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-600/20 text-sm font-semibold text-pink-300">{n}</span>
            <span><strong className="text-neutral-200">{t}.</strong> <span className="text-neutral-400">{d}</span></span>
          </li>
        ))}
      </ol>
      <button onClick={onNext} className="btn-gold mt-5 w-full rounded-full py-2.5 font-medium">
        Empecemos
      </button>
    </Card>
  );
}

function ProfileStep({ profile, regions, onSaved }: { profile: ProfileLite | null; regions: Opt[]; onSaved: () => void }) {
  const [cities, setCities] = useState<Opt[]>([]);
  const [region, setRegion] = useState(profile?.city?.region?.slug ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (region) dashboard.cities(region).then((c) => setCities(c as Opt[]));
    else setCities([]);
  }, [region]);

  async function save(form: FormData) {
    setErr(""); setBusy(true);
    const data: Record<string, unknown> = {
      stage_name: form.get("stage_name"),
      gender: form.get("gender"),
      age: Number(form.get("age")),
      whatsapp: form.get("whatsapp") || "",
      telegram: form.get("telegram") || "",
      description: form.get("description") || "",
      base_rate: form.get("base_rate") ? Number(form.get("base_rate")) : null,
    };
    const cityId = form.get("city_id");
    if (cityId) data.city_id = Number(cityId);
    try {
      if (profile) await dashboard.updateProfile(profile.id, data);
      else await dashboard.createProfile(data);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Tu perfil" intro="Así te van a ver y contactar. Puedes editarlo cuando quieras.">
      <form action={save} className="space-y-3">
        <input name="stage_name" defaultValue={profile?.stage_name} placeholder="Nombre artístico" required className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <select name="gender" defaultValue={profile?.gender ?? "female"} className={inputCls}>
            <option value="female">Mujer</option>
            <option value="trans">Trans</option>
            <option value="male">Hombre</option>
          </select>
          <input name="age" type="number" min={18} defaultValue={profile?.age} placeholder="Edad" required className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
            <option value="">Región…</option>
            {regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </select>
          <select name="city_id" defaultValue={profile?.city?.id} className={inputCls} disabled={!region}>
            <option value="">Comuna…</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <input name="whatsapp" defaultValue={profile?.whatsapp} placeholder="WhatsApp (ej: 56912345678)" inputMode="tel" className={inputCls} />
        <input name="telegram" defaultValue={profile?.telegram} placeholder="Telegram (opcional, sin @)" className={inputCls} />
        <input name="base_rate" type="number" min={0} step={1000} defaultValue={profile?.base_rate ?? ""} placeholder="Tarifa base (CLP, opcional)" inputMode="numeric" className={inputCls} />
        <textarea name="description" defaultValue={profile?.description} placeholder="Cuéntales sobre ti (opcional)" rows={3} className={inputCls} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button disabled={busy} className="btn-gold w-full rounded-full py-2.5 font-medium disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar y continuar →"}
        </button>
      </form>
    </Card>
  );
}

interface Challenge { code: string; statement: string }

function KycStep({ submitted, status, onDone, onSkip }: { submitted: boolean; status?: string; onDone: () => void; onSkip: () => void }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const showForm = !submitted || replace;

  const fetchChallenge = useCallback(async () => {
    try { setChallenge(await dashboard.issueKycChallenge()); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo generar el código"); }
  }, []);
  useEffect(() => { if (showForm) fetchChallenge(); }, [showForm, fetchChallenge]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    if (!challenge) { setErr("Espera el código de validación."); return; }
    const fd = new FormData(e.currentTarget);
    fd.append("challenge_code", challenge.code);
    const id = fd.get("id_document"), selfie = fd.get("selfie"), video = fd.get("consent_video");
    if (![id, selfie, video].every((f) => f instanceof File && f.size > 0)) {
      setErr("Selecciona los tres archivos: cédula, selfie y video."); return;
    }
    for (const [label, file, kind, mb] of [
      ["Cédula", id, "image/", MAX_IMG_MB], ["Selfie", selfie, "image/", MAX_IMG_MB], ["Video", video, "video/", MAX_VIDEO_MB],
    ] as const) {
      const f = file as File;
      if (!f.type.startsWith(kind)) { setErr(`${label} debe ser ${kind === "image/" ? "una imagen" : "un video"}.`); return; }
      if (f.size > mb * 1_048_576) { setErr(`${label} muy grande (máx ${mb} MB).`); return; }
    }
    setBusy(true);
    try { await dashboard.submitVerification(fd); formRef.current?.reset(); onDone(); }
    catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Error al enviar");
      if (caught instanceof Error && /desaf[íi]o/i.test(caught.message)) fetchChallenge();
    } finally { setBusy(false); }
  }

  if (submitted && !replace) {
    return (
      <Card title="Tu identidad" intro="Verificamos tu identidad para proteger la plataforma. Es privado.">
        <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 p-4 text-sm">
          <p className="font-semibold text-sky-200">
            {status === "verified" ? "✅ Identidad verificada" : status === "rejected" ? "❌ Verificación rechazada" : "📤 Documentos en revisión"}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {status === "pending" && "Te avisaremos por notificación cuando se apruebe (suele tardar pocas horas)."}
            {status === "verified" && "¡Listo! Ya puedes continuar."}
            {status === "rejected" && "Revisa el motivo en tu panel y vuelve a enviar."}
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onSkip} className="btn-gold flex-1 rounded-full py-2.5 font-medium">Continuar →</button>
          <button onClick={() => setReplace(true)} className="rounded-full border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-pink-500">Reemplazar</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Tu identidad" intro="Obligatorio para publicar. Tus documentos se guardan cifrados y solo los ve el equipo de verificación.">
      {challenge && (
        <div className="mb-3 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          📹 En tu <strong>video</strong>, mira a la cámara y di en voz alta:
          <p className="mt-1 rounded-lg bg-black/30 px-3 py-2 font-medium text-amber-200">“{challenge.statement}”</p>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3 text-sm">
        <Field label="Foto de tu cédula"><input name="id_document" type="file" accept="image/*" required className="text-neutral-300" /></Field>
        <Field label="Selfie sosteniendo tu cédula"><input name="selfie" type="file" accept="image/*" required className="text-neutral-300" /></Field>
        <Field label="Video corto leyendo la frase de arriba"><input name="consent_video" type="file" accept="video/*" required className="text-neutral-300" /></Field>
        {err && <p className="text-red-400">{err}</p>}
        <button disabled={busy} className="btn-gold w-full rounded-full py-2.5 font-medium disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar y continuar →"}
        </button>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function PhotosStep({ avatar, photos, onChange, onNext }: { avatar: string | null; photos: MediaItem[]; onChange: () => void; onNext: () => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function upAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_IMG_MB * 1_048_576) { setErr(`Imagen muy grande (máx ${MAX_IMG_MB} MB).`); return; }
    setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("avatar", f); await dashboard.uploadAvatar(fd); onChange(); }
    catch (er) { setErr(er instanceof Error ? er.message : "Error"); } finally { setBusy(false); }
  }
  async function upPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_IMG_MB * 1_048_576) { setErr(`Imagen muy grande (máx ${MAX_IMG_MB} MB).`); return; }
    setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("upload", f); fd.append("media_type", "photo"); await dashboard.uploadMedia(fd); onChange(); }
    catch (er) { setErr(er instanceof Error ? er.message : "Error"); } finally { setBusy(false); }
  }

  return (
    <Card title="Tus fotos" intro="Tu foto principal aparece en los listados. Las del muro completan tu perfil (hasta 6).">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-full border border-neutral-700 bg-neutral-950">
          {avatar && <Image src={avatar} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />}
        </div>
        <label className="cursor-pointer rounded-full border border-neutral-700 px-4 py-2 text-sm hover:border-pink-500">
          {avatar ? "Cambiar foto principal" : "Subir foto principal"}
          <input type="file" accept="image/*" className="hidden" onChange={upAvatar} disabled={busy} />
        </label>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs text-neutral-400">Fotos del muro ({photos.length}/6)</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((m) => (
            <div key={m.id} className="h-20 w-20 overflow-hidden rounded-lg border border-neutral-800">
              <Image src={m.file_url} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
            </div>
          ))}
          {photos.length < 6 && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-700 text-2xl text-neutral-500 hover:border-pink-500">
              +
              <input type="file" accept="image/*" className="hidden" onChange={upPhoto} disabled={busy} />
            </label>
          )}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button onClick={onNext} disabled={!avatar && photos.length === 0} className="btn-gold mt-5 w-full rounded-full py-2.5 font-medium disabled:opacity-50">
        Continuar →
      </button>
      {!avatar && photos.length === 0 && <p className="mt-2 text-center text-xs text-neutral-500">Sube al menos una foto para continuar.</p>}
    </Card>
  );
}

function AdStep({ plans, pubs, onChange, onNext }: { plans: Plan[]; pubs: Pub[]; onChange: () => void; onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  const [payInfo, setPayInfo] = useState("");
  const existing = pubs[0];

  useEffect(() => {
    dashboard.paymentInfo().then((d) => setPayInfo(d.payment_instructions)).catch(() => {});
  }, []);

  async function create(planId: number) {
    setBusy(true);
    try {
      await dashboard.createPublication({ plan_id: planId });
      toast("Anuncio creado · ahora sube tu comprobante");
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear", "error");
    } finally { setBusy(false); }
  }

  return (
    <Card title="Tu anuncio" intro="Elige tu plan y crea tu anuncio. Luego transfieres y subes el comprobante; el equipo lo aprueba y quedas visible.">
      {existing ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            ✅ ¡Anuncio creado! Ahora <strong>transfiere</strong> y sube tu <strong>comprobante</strong> desde tu panel para activarlo.
          </div>
          {payInfo.trim() && (
            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs">
              <p className="mb-1 font-semibold text-neutral-300">💳 Datos para tu transferencia</p>
              <p className="whitespace-pre-line text-neutral-400">{payInfo}</p>
            </div>
          )}
        </div>
      ) : (
        <PlanPicker plans={plans} onChoose={create} busy={busy} />
      )}
      <button onClick={onNext} className="mt-4 w-full rounded-full border border-neutral-700 py-2.5 text-sm text-neutral-300 hover:border-pink-500">
        Continuar →
      </button>
    </Card>
  );
}

function DoneStep({ profile }: { profile: ProfileLite | null }) {
  const verified = profile?.verification_status === "verified";
  return (
    <Card title="¡Todo listo! 🎉" intro={verified ? "Tu perfil ya está visible." : "Cuando aprobemos tu identidad, tu perfil quedará visible automáticamente."}>
      <p className="text-sm text-neutral-400">
        Desde tu panel puedes editar todo, gestionar tus fotos y anuncios, ver tus estadísticas y responder reseñas.
      </p>
      <Link href="/dashboard" className="btn-gold mt-5 block rounded-full py-2.5 text-center font-medium">
        Ir a mi panel
      </Link>
    </Card>
  );
}

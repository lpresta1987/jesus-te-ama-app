import React, { useEffect, useMemo, useState } from "react";

/**
 * Jesus te Ama — Church App (MVP)
 * - Mobile-first web app (single-file React)
 * - Bilingual (ES/EN)
 * - No login
 * - Features: Sermons/Livestream, Prayer Request form (to Google Sheets + email via Apps Script), Events/Calendar, Announcements, Giving buttons
 *
 * HOW TO CONNECT GOOGLE SHEETS + EMAIL (Recommended: Google Apps Script)
 * 1) Create a Google Sheet with tabs:
 *    - PrayerRequests (headers: Timestamp, Name, Email, Phone, Language, Request, PermissionToShare)
 *    - Announcements (headers: Timestamp, Language, Title, Body, Link)
 *    - Events (headers: StartISO, EndISO, Title, Description, Location, Link, Language)
 *
 * 2) Extensions -> Apps Script. Paste a script that:
 *    - doGet(): returns announcements + events as JSON
 *    - doPost(): writes prayer requests to sheet and sends email notification
 * 3) Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4) Copy the Web App URL and paste into the constants below.
 */

// ============ CONFIG (EDIT THESE) ============
const CONFIG = {
  // Your Google Apps Script Web App URL (ends with "/exec")
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwmfijQzwlEb43Fu2trR5im5UrOm8ChM5keTwRe6hbyg2bdAZvIspINu0BM10MhXg_Jew/exec",

  // Sermons / livestream
  LIVESTREAMS: {
    youtube: "https://www.youtube.com/@REPLACE_ME/live",
    facebook: "https://www.facebook.com/REPLACE_ME/live",
  },

  // Giving buttons
  GIVING: {
    zelle: "https://enroll.zellepay.com/qr-codes?data=REPLACE_ME", // or a short link / image QR
    cashapp: "https://cash.app/$REPLACE_ME",
    website: "https://REPLACE_ME",
  },

  // Optional: if you store sermons as a playlist
  SERMONS: {
    youtubePlaylist: "https://www.youtube.com/playlist?list=REPLACE_ME",
    podcast: "https://open.spotify.com/show/REPLACE_ME",
  },

  // Optional: church contact
  CONTACT: {
    phone: "(REPLACE) 000-0000",
    email: "info@REPLACE_ME.org",
    address: "Annapolis, MD",
  },
};

// ============ UI TEXT ============
const I18N = {
  es: {
    appName: "Jesús te Ama",
    tabs: { home: "Inicio", sermons: "Predicaciones", events: "Eventos", prayer: "Oración", give: "Ofrendar" },
    language: "Idioma",
    home: {
      title: "Bienvenidos",
      quick: "Accesos rápidos",
      announcements: "Anuncios",
      noAnnouncements: "No hay anuncios por ahora.",
      contact: "Contacto",
    },
    sermons: {
      title: "Predicaciones y En Vivo",
      live: "En vivo",
      watchYouTube: "Ver en YouTube",
      watchFacebook: "Ver en Facebook",
      library: "Biblioteca",
      playlist: "Playlist de YouTube",
      podcast: "Podcast",
    },
    events: {
      title: "Eventos",
      upcoming: "Próximos eventos",
      none: "No hay eventos publicados.",
      addToCalendar: "Agregar a calendario",
    },
    prayer: {
      title: "Petición de oración",
      subtitle: "Tu petición llega al equipo pastoral. También recibiremos una notificación por email.",
      name: "Nombre",
      email: "Correo",
      phone: "Teléfono (opcional)",
      request: "¿Cómo podemos orar por ti?",
      permission: "Permiso para compartir con el grupo de oración",
      submit: "Enviar",
      sending: "Enviando...",
      sent: "¡Listo! Recibimos tu petición.",
      error: "No se pudo enviar. Intenta de nuevo.",
    },
    give: {
      title: "Ofrendas / Donar",
      subtitle: "Gracias por tu generosidad. 🙏",
      zelle: "Dar por Zelle",
      cashapp: "Dar por CashApp",
      website: "Dar en el sitio web",
    },
    common: {
      open: "Abrir",
      learnMore: "Más info",
      link: "Enlace",
      loading: "Cargando...",
      refresh: "Actualizar",
    },
  },
  en: {
    appName: "Jesus Te Ama",
    tabs: { home: "Home", sermons: "Sermons", events: "Events", prayer: "Prayer", give: "Give" },
    language: "Language",
    home: {
      title: "Welcome",
      quick: "Quick links",
      announcements: "Announcements",
      noAnnouncements: "No announcements right now.",
      contact: "Contact",
    },
    sermons: {
      title: "Sermons & Livestream",
      live: "Live",
      watchYouTube: "Watch on YouTube",
      watchFacebook: "Watch on Facebook",
      library: "Library",
      playlist: "YouTube Playlist",
      podcast: "Podcast",
    },
    events: {
      title: "Events",
      upcoming: "Upcoming",
      none: "No events posted yet.",
      addToCalendar: "Add to calendar",
    },
    prayer: {
      title: "Prayer request",
      subtitle: "Your request goes to the pastoral team. We’ll also get an email notification.",
      name: "Name",
      email: "Email",
      phone: "Phone (optional)",
      request: "How can we pray for you?",
      permission: "Permission to share with the prayer group",
      submit: "Send",
      sending: "Sending...",
      sent: "Done! We received your request.",
      error: "Couldn’t send. Please try again.",
    },
    give: {
      title: "Give",
      subtitle: "Thank you for your generosity. 🙏",
      zelle: "Give via Zelle",
      cashapp: "Give via CashApp",
      website: "Give on website",
    },
    common: {
      open: "Open",
      learnMore: "Learn more",
      link: "Link",
      loading: "Loading...",
      refresh: "Refresh",
    },
  },
};

// ============ HELPERS ============
function clsx(...args) {
  return args.filter(Boolean).join(" ");
}

function formatEventDate(iso, lang) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === "es" ? "es-US" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildIcs({ title, startISO, endISO, description, location, url }) {
  // Minimal ICS for “Add to calendar”
  const dt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${Math.random().toString(16).slice(2)}@jesusteama`;
  const esc = (s = "") => String(s).replace(/\\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JesusTeAma//ChurchApp//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(startISO)}`,
    `DTEND:${dt(endISO || startISO)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description || "")}${url ? "\\n" + esc(url) : ""}`,
    location ? `LOCATION:${esc(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ============ MAIN APP ============
export default function App() {
  const [lang, setLang] = useState("es");
  const t = I18N[lang];
  const [tab, setTab] = useState("home");

  // Data from Google Sheets (via Apps Script)
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const brand = useMemo(
    () => ({
      primary: "#0FA7C9",
      primaryDark: "#0B7F98",
      bg: "#f7fafc",
      card: "#ffffff",
      text: "#0f172a",
      muted: "#475569",
      border: "#e2e8f0",
    }),
    []
  );

  async function fetchData() {
    if (!CONFIG.APPS_SCRIPT_URL.includes("script.google.com")) {
      // No endpoint configured — keep it usable with placeholders
      setAnnouncements([
        {
          title: lang === "es" ? "Ejemplo: Bienvenidos" : "Sample: Welcome",
          body:
            lang === "es"
              ? "Configura tu Google Sheet + Apps Script para ver anuncios reales aquí." 
              : "Connect Google Sheets + Apps Script to show real announcements here.",
          link: "",
          language: lang,
        },
      ]);
      setEvents([
        {
          title: lang === "es" ? "Servicio Dominical" : "Sunday Service",
          description: lang === "es" ? "Adoración y Palabra" : "Worship & Word",
          location: CONFIG.CONTACT.address,
          link: "",
          startISO: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          endISO: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
          language: lang,
        },
      ]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=feed&lang=${lang}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Bad response");
      const json = await res.json();
      setAnnouncements(Array.isArray(json.announcements) ? json.announcements : []);
      setEvents(Array.isArray(json.events) ? json.events : []);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div
      className="min-h-screen"
      style={{ background: brand.bg, color: brand.text, fontFamily: "ui-sans-serif, system-ui" }}
    >
      <Header lang={lang} setLang={setLang} title={t.appName} brand={brand} />

      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
        {tab === "home" && (
          <Home
            t={t}
            brand={brand}
            announcements={announcements}
            loading={loading}
            loadError={loadError}
            onRefresh={fetchData}
          />
        )}
        {tab === "sermons" && <Sermons t={t} brand={brand} />}
        {tab === "events" && (
          <Events t={t} brand={brand} events={events} loading={loading} loadError={loadError} onRefresh={fetchData} lang={lang} />
        )}
        {tab === "prayer" && <Prayer t={t} brand={brand} lang={lang} />}
        {tab === "give" && <Give t={t} brand={brand} />}
      </main>

      <BottomNav t={t} tab={tab} setTab={setTab} brand={brand} />
    </div>
  );
}

function Header({ title, lang, setLang, brand }) {
  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{ background: "rgba(255,255,255,0.92)", borderColor: brand.border, backdropFilter: "blur(10px)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Replace /logo.png with your hosted logo */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryDark})` }}
            aria-hidden
          >
            <span className="text-lg font-bold" style={{ color: "white" }}>
              J
            </span>
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">{title}</div>
            <div className="text-xs" style={{ color: brand.muted }}>
              {lang === "es" ? "App de la iglesia" : "Church app"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={clsx(
              "rounded-xl border px-3 py-2 text-xs font-semibold",
              lang === "es" ? "" : "opacity-70"
            )}
            style={{ borderColor: brand.border, background: lang === "es" ? brand.card : "transparent" }}
            onClick={() => setLang("es")}
          >
            ES
          </button>
          <button
            className={clsx(
              "rounded-xl border px-3 py-2 text-xs font-semibold",
              lang === "en" ? "" : "opacity-70"
            )}
            style={{ borderColor: brand.border, background: lang === "en" ? brand.card : "transparent" }}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

function Card({ brand, children }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm" style={{ background: brand.card, borderColor: brand.border }}>
      {children}
    </div>
  );
}

function SectionTitle({ brand, children, right }) {
  return (
    <div className="mb-2 mt-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold" style={{ color: brand.text }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

function SmallButton({ brand, onClick, children }) {
  return (
    <button
      className="rounded-xl border px-3 py-2 text-xs font-semibold"
      style={{ borderColor: brand.border, background: brand.card }}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Home({ t, brand, announcements, loading, loadError, onRefresh }) {
  return (
    <div className="space-y-4">
      <Card brand={brand}>
        <div className="text-lg font-semibold" style={{ color: brand.text }}>
          {t.home.title}
        </div>
        <div className="mt-1 text-sm" style={{ color: brand.muted }}>
          {t.appName} — {t.home.quick}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <QuickLink brand={brand} href={CONFIG.LIVESTREAMS.youtube} label={t.sermons.watchYouTube} />
          <QuickLink brand={brand} href={CONFIG.LIVESTREAMS.facebook} label={t.sermons.watchFacebook} />
          <QuickLink brand={brand} href={CONFIG.GIVING.zelle} label={t.give.zelle} />
          <QuickLink brand={brand} href={`mailto:${CONFIG.CONTACT.email}`} label={t.home.contact} />
        </div>
      </Card>

      <SectionTitle
        brand={brand}
        right={
          <SmallButton brand={brand} onClick={onRefresh}>
            {t.common.refresh}
          </SmallButton>
        }
      >
        {t.home.announcements}
      </SectionTitle>

      <Card brand={brand}>
        {loading ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.common.loading}
          </div>
        ) : loadError ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.common.loading}… ({t.common.refresh})
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.home.noAnnouncements}
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a, idx) => (
              <div key={idx} className="rounded-xl border p-3" style={{ borderColor: brand.border }}>
                <div className="text-sm font-semibold">{a.title}</div>
                {a.body ? <div className="mt-1 text-sm" style={{ color: brand.muted }}>{a.body}</div> : null}
                {a.link ? (
                  <a className="mt-2 inline-block text-sm font-semibold" style={{ color: brand.primary }} href={a.link} target="_blank" rel="noreferrer">
                    {t.common.open}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card brand={brand}>
        <div className="text-sm font-semibold">{t.home.contact}</div>
        <div className="mt-2 space-y-1 text-sm" style={{ color: brand.muted }}>
          <div>{CONFIG.CONTACT.address}</div>
          <a href={`tel:${CONFIG.CONTACT.phone}`} style={{ color: brand.primary }} className="font-semibold">
            {CONFIG.CONTACT.phone}
          </a>
          <div>
            <a href={`mailto:${CONFIG.CONTACT.email}`} style={{ color: brand.primary }} className="font-semibold">
              {CONFIG.CONTACT.email}
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

function QuickLink({ brand, href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border p-3 text-sm font-semibold shadow-sm"
      style={{ borderColor: brand.border, background: brand.card, color: brand.text }}
    >
      {label}
      <div className="mt-1 text-xs" style={{ color: brand.muted }}>
        {href ? new URL(href).hostname.replace("www.", "") : ""}
      </div>
    </a>
  );
}

function Sermons({ t, brand }) {
  return (
    <div className="space-y-4">
      <Card brand={brand}>
        <div className="text-lg font-semibold">{t.sermons.title}</div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <a
            href={CONFIG.LIVESTREAMS.youtube}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border p-4"
            style={{ borderColor: brand.border }}
          >
            <div className="text-sm font-semibold">YouTube — {t.sermons.live}</div>
            <div className="mt-1 text-sm" style={{ color: brand.muted }}>
              {t.sermons.watchYouTube}
            </div>
          </a>
          <a
            href={CONFIG.LIVESTREAMS.facebook}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border p-4"
            style={{ borderColor: brand.border }}
          >
            <div className="text-sm font-semibold">Facebook — {t.sermons.live}</div>
            <div className="mt-1 text-sm" style={{ color: brand.muted }}>
              {t.sermons.watchFacebook}
            </div>
          </a>
        </div>
      </Card>

      <Card brand={brand}>
        <div className="text-sm font-semibold">{t.sermons.library}</div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <a
            href={CONFIG.SERMONS.youtubePlaylist}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border p-4"
            style={{ borderColor: brand.border }}
          >
            <div className="text-sm font-semibold">{t.sermons.playlist}</div>
            <div className="mt-1 text-sm" style={{ color: brand.muted }}>
              YouTube
            </div>
          </a>
          <a
            href={CONFIG.SERMONS.podcast}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border p-4"
            style={{ borderColor: brand.border }}
          >
            <div className="text-sm font-semibold">{t.sermons.podcast}</div>
            <div className="mt-1 text-sm" style={{ color: brand.muted }}>
              Spotify / Apple Podcasts
            </div>
          </a>
        </div>
      </Card>
    </div>
  );
}

function Events({ t, brand, events, loading, loadError, onRefresh, lang }) {
  return (
    <div className="space-y-4">
      <SectionTitle
        brand={brand}
        right={
          <SmallButton brand={brand} onClick={onRefresh}>
            {t.common.refresh}
          </SmallButton>
        }
      >
        {t.events.title}
      </SectionTitle>

      <Card brand={brand}>
        {loading ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.common.loading}
          </div>
        ) : loadError ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.common.loading}… ({t.common.refresh})
          </div>
        ) : events.length === 0 ? (
          <div className="text-sm" style={{ color: brand.muted }}>
            {t.events.none}
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev, idx) => (
              <div key={idx} className="rounded-2xl border p-4" style={{ borderColor: brand.border }}>
                <div className="text-sm font-semibold">{ev.title}</div>
                <div className="mt-1 text-sm" style={{ color: brand.muted }}>
                  {formatEventDate(ev.startISO, lang)}
                  {ev.location ? ` • ${ev.location}` : ""}
                </div>
                {ev.description ? <div className="mt-2 text-sm" style={{ color: brand.muted }}>{ev.description}</div> : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {ev.link ? (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl px-3 py-2 text-xs font-semibold"
                      style={{ background: brand.primary, color: "white" }}
                    >
                      {t.common.open}
                    </a>
                  ) : null}

                  <button
                    className="rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: brand.border, background: brand.card }}
                    onClick={() => {
                      const ics = buildIcs({
                        title: ev.title,
                        startISO: ev.startISO,
                        endISO: ev.endISO,
                        description: ev.description,
                        location: ev.location,
                        url: ev.link,
                      });
                      downloadTextFile(`${ev.title}.ics`, ics);
                    }}
                    type="button"
                  >
                    {t.events.addToCalendar}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Prayer({ t, brand, lang }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState("");
  const [permission, setPermission] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  async function submit(e) {
    e.preventDefault();
    setStatus("sending");

    // If Apps Script isn't configured yet, simulate success so you can demo the app.
    if (!CONFIG.APPS_SCRIPT_URL.includes("script.google.com")) {
      setTimeout(() => setStatus("sent"), 800);
      return;
    }

    try {
      const payload = {
        action: "prayer",
        name,
        email,
        phone,
        request,
        permissionToShare: permission,
        language: lang,
      };

      const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Bad response");
      const json = await res.json();
      if (!json || json.ok !== true) throw new Error("Not ok");

      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setRequest("");
      setPermission(false);
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <Card brand={brand}>
        <div className="text-lg font-semibold">{t.prayer.title}</div>
        <div className="mt-1 text-sm" style={{ color: brand.muted }}>
          {t.prayer.subtitle}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <LabeledInput brand={brand} label={t.prayer.name} value={name} onChange={setName} required />
          <LabeledInput brand={brand} label={t.prayer.email} value={email} onChange={setEmail} type="email" required />
          <LabeledInput brand={brand} label={t.prayer.phone} value={phone} onChange={setPhone} />

          <div>
            <div className="mb-1 text-xs font-semibold" style={{ color: brand.muted }}>
              {t.prayer.request}
            </div>
            <textarea
              className="w-full rounded-2xl border p-3 text-sm"
              style={{ borderColor: brand.border, background: brand.card }}
              rows={5}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: brand.muted }}>
            <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} />
            {t.prayer.permission}
          </label>

          <button
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: brand.primary, color: "white" }}
            disabled={status === "sending"}
            type="submit"
          >
            {status === "sending" ? t.prayer.sending : t.prayer.submit}
          </button>

          {status === "sent" ? (
            <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: brand.border, color: brand.primaryDark }}>
              {t.prayer.sent}
            </div>
          ) : null}
          {status === "error" ? (
            <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fff1f2" }}>
              {t.prayer.error}
            </div>
          ) : null}
        </form>
      </Card>

      <Card brand={brand}>
        <div className="text-sm font-semibold">Privacy</div>
        <div className="mt-2 text-sm" style={{ color: brand.muted }}>
          {lang === "es"
            ? "Solo el equipo pastoral verá estas peticiones. Puedes elegir si se comparte con el grupo de oración."
            : "Only the pastoral team will see these requests. You can choose whether it’s shared with the prayer team."}
        </div>
      </Card>
    </div>
  );
}

function LabeledInput({ brand, label, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold" style={{ color: brand.muted }}>
        {label}
      </div>
      <input
        className="w-full rounded-2xl border p-3 text-sm"
        style={{ borderColor: brand.border, background: brand.card }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
      />
    </div>
  );
}

function Give({ t, brand }) {
  return (
    <div className="space-y-4">
      <Card brand={brand}>
        <div className="text-lg font-semibold">{t.give.title}</div>
        <div className="mt-1 text-sm" style={{ color: brand.muted }}>
          {t.give.subtitle}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <GiveButton brand={brand} href={CONFIG.GIVING.zelle} label={t.give.zelle} />
          <GiveButton brand={brand} href={CONFIG.GIVING.cashapp} label={t.give.cashapp} />
          <GiveButton brand={brand} href={CONFIG.GIVING.website} label={t.give.website} />
        </div>
      </Card>

      <Card brand={brand}>
        <div className="text-sm font-semibold">Tip</div>
        <div className="mt-2 text-sm" style={{ color: brand.muted }}>
          {"You can replace the Zelle link with a QR image page, or a short link that opens the Zelle instructions."}
        </div>
      </Card>
    </div>
  );
}

function GiveButton({ brand, href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border p-4 text-sm font-semibold"
      style={{ borderColor: brand.border, background: brand.card, color: brand.text }}
    >
      {label}
      <div className="mt-1 text-xs" style={{ color: brand.muted }}>
        {href ? new URL(href).hostname.replace("www.", "") : ""}
      </div>
    </a>
  );
}

function BottomNav({ t, tab, setTab, brand }) {
  const items = [
    { id: "home", label: t.tabs.home, icon: "⌂" },
    { id: "sermons", label: t.tabs.sermons, icon: "▶" },
    { id: "events", label: t.tabs.events, icon: "📅" },
    { id: "prayer", label: t.tabs.prayer, icon: "🙏" },
    { id: "give", label: t.tabs.give, icon: "❤" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t"
      style={{ background: "rgba(255,255,255,0.95)", borderColor: brand.border, backdropFilter: "blur(10px)" }}
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
        {items.map((it) => {
          const active = it.id === tab;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className="rounded-2xl px-2 py-2"
              style={{
                background: active ? brand.bg : "transparent",
                color: active ? brand.primaryDark : brand.muted,
              }}
              type="button"
            >
              <div className="text-base leading-none">{it.icon}</div>
              <div className="mt-1 text-[11px] font-semibold">{it.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

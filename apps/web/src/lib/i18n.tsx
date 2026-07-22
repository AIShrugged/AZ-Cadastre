/**
 * Trilingual UI (RU / EN / AZ) — a first-class product constraint, not an
 * afterthought. Every user-facing string lives here in all three languages,
 * including Cyrillic (RU) and Azerbaijani Latin (AZ). Layouts must tolerate
 * the length and script variance these produce.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type Locale = "en" | "ru" | "az"

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "az", label: "Azərbaycan", short: "AZ" },
  { id: "ru", label: "Русский", short: "RU" },
  { id: "en", label: "English", short: "EN" },
]

type Dict = Record<string, string>

const en: Dict = {
  "authority": "Real Estate Registration Authority",
  "nav.workspace": "Workspace",
  "nav.register": "Register",
  "nav.new": "New verification",
  "nav.profiles": "Profiles",
  "nav.audit": "Audit trail",
  "role.inspector": "Inspector",
  "page.register.title": "Verification register",
  "page.register.subtitle": "Packages awaiting your decision. The system prepares the evidence — you decide.",
  "search.placeholder": "Search package ID or applicant…",
  "action.new": "New verification",
  "density.label": "Density",
  "density.comfortable": "Comfortable",
  "density.compact": "Compact",
  "col.package": "Package",
  "col.profile": "Profile",
  "col.documents": "Documents",
  "col.findings": "Findings",
  "col.submitted": "Submitted",
  "col.status": "Status",
  "status.ok": "No issues",
  "status.issues": "Issues found",
  "status.incomplete": "Incomplete package",
  "status.in_progress": "In progress",
  "status.failed": "Verification failed",
  "seg.all": "All",
  "seg.in_progress": "In progress",
  "seg.issues": "Issues",
  "seg.incomplete": "Incomplete",
  "seg.ok": "No issues",
  "seg.failed": "Failed",
  "findings.issues": "{n} issues",
  "findings.issue_one": "1 issue",
  "findings.low": "{n} low-confidence",
  "findings.none": "None",
  "docs.count": "{d} of {r} required",
  "stage.progress": "Stage {k} of {n}",
  "stage.1": "OCR",
  "stage.2": "Classification",
  "stage.3": "Field extraction",
  "stage.4": "Completeness",
  "stage.5": "Cross-checks",
  "stage.6": "Report",
  "empty.title": "The register is empty",
  "empty.body": "Start a verification and the package will appear here with live progress.",
  "empty.filtered.title": "No packages match",
  "empty.filtered.body": "No packages in this segment. Clear the filter to see the full register.",
  "empty.clear": "Clear filter",
  "page.showing": "{a}–{b} of {n}",
  "page.prev": "Previous",
  "page.next": "Next",
  "demo.badge": "Demo data",
  "demo.note": "Synthetic packages from the demo profile — replace with live data.",
  "min_conf": "min {c}%",
  "updated.ago": "updated {t} ago",
  "open": "Open",
  "profile.demo": "Demo profile",
  "profile.cadastre": "Cadastre · land parcel",
  "toast.opened": "Opening package {id}",
  "toast.new": "New verification — upload flow is outside this view",
  "lang.label": "Language",
  "theme.label": "Appearance",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.to_light": "Switch to light",
  "theme.to_dark": "Switch to dark",
  "sidebar.toggle": "Toggle sidebar",
}

const ru: Dict = {
  "authority": "Управление регистрации недвижимости",
  "nav.workspace": "Рабочая область",
  "nav.register": "Реестр",
  "nav.new": "Новая проверка",
  "nav.profiles": "Профили",
  "nav.audit": "Журнал аудита",
  "role.inspector": "Инспектор",
  "page.register.title": "Реестр проверок",
  "page.register.subtitle": "Пакеты, ожидающие вашего решения. Система готовит доказательства — решаете вы.",
  "search.placeholder": "Поиск по номеру пакета или заявителю…",
  "action.new": "Новая проверка",
  "density.label": "Плотность",
  "density.comfortable": "Свободно",
  "density.compact": "Компактно",
  "col.package": "Пакет",
  "col.profile": "Профиль",
  "col.documents": "Документы",
  "col.findings": "Замечания",
  "col.submitted": "Подано",
  "col.status": "Статус",
  "status.ok": "Без замечаний",
  "status.issues": "Найдены замечания",
  "status.incomplete": "Неполный пакет",
  "status.in_progress": "В обработке",
  "status.failed": "Проверка не удалась",
  "seg.all": "Все",
  "seg.in_progress": "В обработке",
  "seg.issues": "Замечания",
  "seg.incomplete": "Неполные",
  "seg.ok": "Без замечаний",
  "seg.failed": "Сбой",
  "findings.issues": "{n} замечаний",
  "findings.issue_one": "1 замечание",
  "findings.low": "{n} с низкой увер.",
  "findings.none": "Нет",
  "docs.count": "{d} из {r} обязательных",
  "stage.progress": "Этап {k} из {n}",
  "stage.1": "OCR",
  "stage.2": "Классификация",
  "stage.3": "Извлечение полей",
  "stage.4": "Комплектность",
  "stage.5": "Сверки",
  "stage.6": "Отчёт",
  "empty.title": "Реестр пуст",
  "empty.body": "Запустите проверку — пакет появится здесь с ходом обработки.",
  "empty.filtered.title": "Совпадений нет",
  "empty.filtered.body": "В этом сегменте нет пакетов. Сбросьте фильтр, чтобы увидеть весь реестр.",
  "empty.clear": "Сбросить фильтр",
  "page.showing": "{a}–{b} из {n}",
  "page.prev": "Назад",
  "page.next": "Вперёд",
  "demo.badge": "Демоданные",
  "demo.note": "Синтетические пакеты демо-профиля — замените реальными данными.",
  "min_conf": "мин. {c}%",
  "updated.ago": "обновлено {t} назад",
  "open": "Открыть",
  "profile.demo": "Демо-профиль",
  "profile.cadastre": "Кадастр · зем. участок",
  "toast.opened": "Открытие пакета {id}",
  "toast.new": "Новая проверка — загрузка вне этого экрана",
  "lang.label": "Язык",
  "theme.label": "Оформление",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная",
  "theme.to_light": "Светлая тема",
  "theme.to_dark": "Тёмная тема",
  "sidebar.toggle": "Показать/скрыть панель",
}

const az: Dict = {
  "authority": "Daşınmaz Əmlakın Qeydiyyatı İdarəsi",
  "nav.workspace": "İş sahəsi",
  "nav.register": "Reyestr",
  "nav.new": "Yeni yoxlama",
  "nav.profiles": "Profillər",
  "nav.audit": "Audit izi",
  "role.inspector": "Müfəttiş",
  "page.register.title": "Yoxlama reyestri",
  "page.register.subtitle": "Qərarınızı gözləyən paketlər. Sistem sübutları hazırlayır — qərarı siz verirsiniz.",
  "search.placeholder": "Paket nömrəsi və ya ərizəçi üzrə axtarış…",
  "action.new": "Yeni yoxlama",
  "density.label": "Sıxlıq",
  "density.comfortable": "Rahat",
  "density.compact": "Sıx",
  "col.package": "Paket",
  "col.profile": "Profil",
  "col.documents": "Sənədlər",
  "col.findings": "Tapıntılar",
  "col.submitted": "Təqdim",
  "col.status": "Status",
  "status.ok": "Qüsur yoxdur",
  "status.issues": "Qüsurlar aşkarlandı",
  "status.incomplete": "Natamam paket",
  "status.in_progress": "İşlənir",
  "status.failed": "Yoxlama alınmadı",
  "seg.all": "Hamısı",
  "seg.in_progress": "İşlənir",
  "seg.issues": "Qüsurlar",
  "seg.incomplete": "Natamam",
  "seg.ok": "Qüsursuz",
  "seg.failed": "Uğursuz",
  "findings.issues": "{n} qüsur",
  "findings.issue_one": "1 qüsur",
  "findings.low": "{n} aşağı etibar",
  "findings.none": "Yoxdur",
  "docs.count": "{r} tələbdən {d}",
  "stage.progress": "Mərhələ {k} / {n}",
  "stage.1": "OCR",
  "stage.2": "Təsnifat",
  "stage.3": "Sahə çıxarışı",
  "stage.4": "Tamlıq",
  "stage.5": "Uyğunluq",
  "stage.6": "Hesabat",
  "empty.title": "Reyestr boşdur",
  "empty.body": "Yoxlamaya başlayın — paket burada emal gedişatı ilə görünəcək.",
  "empty.filtered.title": "Uyğun paket yoxdur",
  "empty.filtered.body": "Bu bölmədə paket yoxdur. Tam reyestri görmək üçün filtri təmizləyin.",
  "empty.clear": "Filtri təmizlə",
  "page.showing": "{n} paketdən {a}–{b}",
  "page.prev": "Əvvəlki",
  "page.next": "Növbəti",
  "demo.badge": "Demo məlumat",
  "demo.note": "Demo profilindən sintetik paketlər — real məlumatla əvəz edin.",
  "min_conf": "min {c}%",
  "updated.ago": "{t} əvvəl yeniləndi",
  "open": "Aç",
  "profile.demo": "Demo profili",
  "profile.cadastre": "Kadastr · torpaq sahəsi",
  "toast.opened": "{id} paketi açılır",
  "toast.new": "Yeni yoxlama — yükləmə bu ekrandan kənardadır",
  "lang.label": "Dil",
  "theme.label": "Görünüş",
  "theme.light": "İşıqlı",
  "theme.dark": "Qaranlıq",
  "theme.to_light": "İşıqlı rejim",
  "theme.to_dark": "Qaranlıq rejim",
  "sidebar.toggle": "Paneli aç/bağla",
}

const DICTS: Record<Locale, Dict> = { en, ru, az }

type I18nValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ru")

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let s = DICTS[locale][key] ?? en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
        }
      }
      return s
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  ru: "ru-RU",
  az: "az-Latn-AZ",
}

export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

/** Compact "time ago" for live/in-progress rows. */
export function relativeShort(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const m = Math.round(diff / 60000)
  if (m < 1) return "0m"
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  return `${d}d`
}

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
  // ── New verification (upload) ──────────────────────────────────────────────
  "page.new.title": "New verification",
  "page.new.subtitle": "Add the submitted documents and start — the system reads and classifies each one.",
  "new.field.profile": "Verification profile",
  "new.field.reference": "Internal reference",
  "new.field.optional": "optional",
  "new.reference.placeholder": "e.g. case note or file number",
  "new.profile.docs": "{n} documents",
  "new.expects": "Expects: {list}",
  "new.dropzone.title": "Drop documents here",
  "new.dropzone.body": "PDF, JPG or PNG · up to {max} MB each",
  "new.dropzone.browse": "Browse files",
  "new.drop_overlay": "Drop files to add",
  "new.uploaded": "Uploaded",
  "new.clear": "Clear all",
  "new.remove": "Remove",
  "new.retry": "Retry",
  "new.reading_pages": "Reading pages…",
  "new.uploading": "Uploading… {p}%",
  "new.pages": "{n} pages",
  "new.page_one": "1 page",
  "new.err.format": "Unsupported format — PDF, JPG or PNG only",
  "new.err.size": "Too large — {max} MB maximum",
  "new.err.failed": "Upload failed",
  "new.files.none": "No files added yet",
  "new.files.all_label": "files",
  "new.files.uploading_label": "uploaded",
  "new.start": "Start verification",
  "new.starting": "Starting…",
  "new.cancel": "Cancel",
  "toast.started": "Verification started — {id}",
  "doctype.passport": "Passport",
  "doctype.driver_license": "Driver license",
  "doctype.application": "Application",
  "doctype.title_deed": "Title deed",
  "doctype.cadastral_extract": "Cadastral extract",
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
  // ── Новая проверка (загрузка) ──────────────────────────────────────────────
  "page.new.title": "Новая проверка",
  "page.new.subtitle": "Добавьте поданные документы и запустите — система читает и классифицирует каждый.",
  "new.field.profile": "Профиль проверки",
  "new.field.reference": "Внутренняя ссылка",
  "new.field.optional": "необязательно",
  "new.reference.placeholder": "напр. номер дела или заметка",
  "new.profile.docs": "{n} документов",
  "new.expects": "Ожидает: {list}",
  "new.dropzone.title": "Перетащите документы сюда",
  "new.dropzone.body": "PDF, JPG или PNG · до {max} МБ каждый",
  "new.dropzone.browse": "Выбрать файлы",
  "new.drop_overlay": "Отпустите файлы для добавления",
  "new.uploaded": "Загружено",
  "new.clear": "Очистить всё",
  "new.remove": "Удалить",
  "new.retry": "Повторить",
  "new.reading_pages": "Чтение страниц…",
  "new.uploading": "Загрузка… {p}%",
  "new.pages": "{n} стр.",
  "new.page_one": "1 стр.",
  "new.err.format": "Неподдерживаемый формат — только PDF, JPG или PNG",
  "new.err.size": "Слишком большой — максимум {max} МБ",
  "new.err.failed": "Ошибка загрузки",
  "new.files.none": "Файлы ещё не добавлены",
  "new.files.all_label": "файлов",
  "new.files.uploading_label": "загружено",
  "new.start": "Запустить проверку",
  "new.starting": "Запуск…",
  "new.cancel": "Отмена",
  "toast.started": "Проверка запущена — {id}",
  "doctype.passport": "Паспорт",
  "doctype.driver_license": "Водительское удостоверение",
  "doctype.application": "Заявление",
  "doctype.title_deed": "Свидетельство о праве",
  "doctype.cadastral_extract": "Кадастровая выписка",
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
  // ── Yeni yoxlama (yükləmə) ──────────────────────────────────────────────────
  "page.new.title": "Yeni yoxlama",
  "page.new.subtitle": "Təqdim olunan sənədləri əlavə edin və başladın — sistem hər birini oxuyur və təsnif edir.",
  "new.field.profile": "Yoxlama profili",
  "new.field.reference": "Daxili istinad",
  "new.field.optional": "istəyə bağlı",
  "new.reference.placeholder": "məs. iş qeydi və ya nömrə",
  "new.profile.docs": "{n} sənəd",
  "new.expects": "Gözlənilir: {list}",
  "new.dropzone.title": "Sənədləri buraya buraxın",
  "new.dropzone.body": "PDF, JPG və ya PNG · hər biri {max} MB-a qədər",
  "new.dropzone.browse": "Fayl seç",
  "new.drop_overlay": "Əlavə etmək üçün faylları buraxın",
  "new.uploaded": "Yükləndi",
  "new.clear": "Hamısını sil",
  "new.remove": "Sil",
  "new.retry": "Yenidən",
  "new.reading_pages": "Səhifələr oxunur…",
  "new.uploading": "Yüklənir… {p}%",
  "new.pages": "{n} səh.",
  "new.page_one": "1 səh.",
  "new.err.format": "Dəstəklənməyən format — yalnız PDF, JPG və ya PNG",
  "new.err.size": "Çox böyük — maksimum {max} MB",
  "new.err.failed": "Yükləmə alınmadı",
  "new.files.none": "Hələ fayl əlavə edilməyib",
  "new.files.all_label": "fayl",
  "new.files.uploading_label": "yükləndi",
  "new.start": "Yoxlamanı başlat",
  "new.starting": "Başladılır…",
  "new.cancel": "Ləğv et",
  "new.back": "Reyestrə qayıt",
  "new.mapping_hint": "Hər tipə uyğun hesab etdiyiniz faylı əlavə edin. Sistem hər sənədi yenidən oxuyur və təsnif edir; sizin uyğunlaşdırmanız burada tamlığı müəyyən edir.",
  "toast.started": "Yoxlama başladı — {id}",
  "doctype.passport": "Pasport",
  "doctype.driver_license": "Sürücülük vəsiqəsi",
  "doctype.application": "Ərizə",
  "doctype.title_deed": "Mülkiyyət şəhadətnaməsi",
  "doctype.cadastral_extract": "Kadastr çıxarışı",
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

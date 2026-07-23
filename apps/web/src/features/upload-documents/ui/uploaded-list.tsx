import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearDocuments, removeDocument } from "../model/slice"
import { selectDocuments } from "../model/selectors"
import { FileRow } from "./file-row"

/** The store-connected list of uploaded documents. Renders nothing when empty. */
export function UploadedList() {
  const { t } = useI18n()
  const dispatch = useAppDispatch()
  const files = useAppSelector(selectDocuments)

  if (files.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="register-label flex items-center gap-2">
          {t("new.uploaded")}
          <span data-mono className="tabular-nums text-muted-foreground">
            {files.length}
          </span>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch(clearDocuments())}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("new.clear")}
        </Button>
      </div>
      <ul className="mt-1 divide-y divide-rule border-t border-rule">
        {files.map((f) => (
          <FileRow key={f.id} att={f} onRemove={() => dispatch(removeDocument(f.id))} />
        ))}
      </ul>
    </div>
  )
}

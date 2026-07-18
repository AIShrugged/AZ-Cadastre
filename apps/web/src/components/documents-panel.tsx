import { useState } from "react";
import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import type { CaseDocument } from "@cadastre/contracts";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { pct } from "@/lib/format";

function DocumentCard({ doc }: { doc: CaseDocument }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
          <FileTextIcon className="size-4.5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{doc.title}</span>
            <span className="truncate text-xs text-muted-foreground">
              Стр. {doc.pageNumbers.join(", ")} · классификация{" "}
              {pct(doc.classificationConfidence)}
            </span>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {doc.fields.length} полей
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">Поле</TableHead>
                <TableHead>Значение</TableHead>
                <TableHead className="w-[28%]">Уверенность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-muted-foreground">
                    {f.label}
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {f.value}
                  </TableCell>
                  <TableCell>
                    <ConfidenceMeter value={f.confidence} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function DocumentsPanel({ documents }: { documents: CaseDocument[] }) {
  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

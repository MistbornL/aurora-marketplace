import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "../../components/ui"
import type { ManagedAuction } from "./types"
import { useI18n } from "../../lib/i18n"

export function DeleteAuctionDialog({ auction, onClose, onConfirm }: { auction: ManagedAuction; onClose: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t("studio.delete.title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("studio.delete.text", { title: auction.title })}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-500 text-white hover:bg-red-400">{t("studio.delete.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

import { useForm, type UseFormReturn } from "react-hook-form"
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "../../components/ui"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form"
import { profileTextFields } from "./schemas"
import type { ProfileFormData } from "./schemas"
import { useI18n } from "../../lib/i18n"

type Props = {
  form: UseFormReturn<ProfileFormData>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProfileFormData) => Promise<void>
  isArtist?: boolean
}

export function ProfileEditorDialog({ form, open, onOpenChange, onSubmit, isArtist = false }: Props) {
  const { t } = useI18n()
  const imageFields = isArtist ? (["avatar", "cover"] as const) : (["avatar"] as const)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("profile.editor.title")}</DialogTitle>
          <DialogDescription>
            {isArtist
              ? t("profile.editor.artistText")
              : t("profile.editor.collectorText")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {imageFields.map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(name === "avatar" ? "profile.editor.uploadAvatar" : "profile.editor.uploadCover")}</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onChange={(event) => field.onChange(event.target.files)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {profileTextFields.map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(item.label)}</FormLabel>
                      <FormControl><Input placeholder={t(item.placeholder)} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-4">
              <p className="text-sm font-semibold text-text">{t("profile.editor.privateTitle")}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t("profile.editor.privateText")}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    { name: "first_name", label: "profile.field.firstName", type: "text" },
                    { name: "last_name", label: "profile.field.lastName", type: "text" },
                    { name: "phone", label: "profile.field.phone", type: "tel" },
                  ] as const
                ).map((item) => (
                  <FormField
                    key={item.name}
                    control={form.control}
                    name={item.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(item.label)}</FormLabel>
                        <FormControl>
                          <Input type={item.type} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <PublicNameChoice form={form} isArtist={isArtist} />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isArtist ? t("profile.editor.artistBio") : t("profile.editor.aboutYou")}</FormLabel>
                  <FormControl><Textarea rows={5} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>{t("common.cancel")}</DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("common.saving") : t("profile.editor.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** How the person appears on their artist page, in bid history and in live chat. */
function PublicNameChoice({ form, isArtist }: { form: UseFormReturn<ProfileFormData>; isArtist: boolean }) {
  const { t } = useI18n()
  const username = form.watch("username")?.trim() || t("profile.publicName.usernamePlaceholder")
  const fullName = `${form.watch("first_name") ?? ""} ${form.watch("last_name") ?? ""}`.trim()
  const choice = form.watch("name_display") ?? "username"
  const error = form.formState.errors.name_display?.message
  const options = [
    { value: "username", title: t("profile.publicName.usernameTitle"), example: username, note: t("profile.publicName.usernameNote") },
    { value: "full_name", title: t("profile.publicName.fullNameTitle"), example: fullName || t("profile.publicName.namePlaceholder"), note: t("profile.publicName.fullNameNote") },
    { value: "both", title: t("profile.publicName.bothTitle"), example: `${fullName || t("profile.publicName.namePlaceholder")} (${username})`, note: t("profile.publicName.bothNote") },
  ] as const
  return (
    <div>
      <p className="text-sm font-semibold text-text">{t("profile.publicName.title")}</p>
      <p className="mt-0.5 text-xs text-text-muted">
        {isArtist
          ? t("profile.publicName.artistText")
          : t("profile.publicName.collectorText")}
      </p>
      <div role="radiogroup" aria-label={t("profile.publicName.aria")} className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            onClick={() => form.setValue("name_display", option.value, { shouldDirty: true, shouldValidate: true })}
            className={`rounded-xl border p-3 text-left transition-colors ${
              choice === option.value ? "border-amber bg-amber/[.07]" : "border-white/10 hover:border-white/25"
            }`}
          >
            <span className="block text-xs font-semibold text-text">{option.title}</span>
            <span className="mt-1 block truncate font-display text-sm text-amber">{option.example}</span>
            <span className="mt-1 block text-[11px] text-text-muted">{option.note}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

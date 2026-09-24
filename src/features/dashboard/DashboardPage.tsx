import { useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { errorMessage, notify } from "../../lib/notify"
import { useI18n } from "../../lib/i18n"
import { useAuth } from "../auth/auth-context"
import { CollectorDashboard } from "../collector/CollectorDashboard"
import {
  getPrivateProfile,
  getProfile,
  savePrivateProfile,
  saveProfile,
  type Profile,
} from "../profile/api"
import { ProfileEditorDialog } from "../profile/ProfileEditorDialog"
import { profileResolver, type ProfileFormData } from "../profile/schemas"
import { ArtistStudio } from "../studio/ArtistStudio"
import { RowsSkeleton } from "../../components/layout/PageSkeletons"
import { Skeleton } from "../../components/ui"

const emptyProfile = {
  username: "",
  location: "",
  website: "",
  instagram: "",
  bio: "",
  x_handle: "",
  name_display: "username" as const,
  first_name: "",
  last_name: "",
  phone: "",
}

/** Preview URL for a picked file; revoked when the file changes/unmounts. */
function useObjectUrl(file: File | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!file) return setUrl(undefined)
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

/** /dashboard — one route, two experiences: collector dashboard or artist studio. */
export default function DashboardPage() {
  const { user, role, refreshProfile } = useAuth()
  const { t } = useI18n()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const form = useForm<ProfileFormData>({
    resolver: profileResolver,
    defaultValues: emptyProfile,
  })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void Promise.all([getProfile(user), getPrivateProfile(user)]).then(
      ([loaded, priv]) => {
        if (cancelled) return
        setProfile(loaded)
        form.reset({ ...loaded, ...priv })
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const avatarPreview = useObjectUrl(form.watch("avatar")?.[0])
  const coverPreview = useObjectUrl(form.watch("cover")?.[0])

  if (!user) return <Message>{t("dashboard.signInPrompt")}</Message>
  if (!profile || !role)
    return (
      <div className="mx-auto min-h-[70vh] max-w-6xl px-6 pt-10 lg:px-10" aria-busy="true">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
        <div className="mt-10">
          <RowsSkeleton />
        </div>
      </div>
    )

  const activeUser = user
  const activeProfile = profile
  const isArtist = role === "artist" || role === "admin"

  async function save(values: ProfileFormData) {
    try {
      const saved = await saveProfile(
        activeUser,
        {
          ...activeProfile,
          username: values.username,
          location: values.location,
          website: values.website,
          instagram: values.instagram,
          bio: values.bio,
          x_handle: values.x_handle,
          name_display: values.name_display,
        },
        values.avatar?.[0],
        values.cover?.[0],
      )
      // Names first: the public name is computed from them.
      await savePrivateProfile(activeUser, {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
      })
      const refreshed = await getProfile(activeUser)
      setProfile({ ...saved, display_name: refreshed.display_name })
      form.reset({
        ...saved,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
      })
      setEditingProfile(false)
      void refreshProfile() // update the navbar avatar/name
      notify(t("dashboard.profileSavedTitle"), t("dashboard.profileSavedDetail"))
    } catch (error) {
      notify(t("dashboard.profileSaveFailed"), errorMessage(error), "error")
    }
  }

  return (
    <>
      {isArtist ? (
        <ArtistStudio
          userId={activeUser.id}
          profile={profile}
          avatar={avatarPreview ?? profile.avatar_url}
          cover={coverPreview ?? profile.cover_url}
          onEditProfile={() => setEditingProfile(true)}
        />
      ) : (
        <CollectorDashboard
          profile={profile}
          avatar={avatarPreview ?? profile.avatar_url}
          onEditProfile={() => setEditingProfile(true)}
        />
      )}
      <ProfileEditorDialog
        form={form}
        open={editingProfile}
        onOpenChange={setEditingProfile}
        onSubmit={save}
        isArtist={isArtist}
      />
    </>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[70vh] place-items-center bg-bg p-6 text-text-secondary">
      {children}
    </div>
  )
}

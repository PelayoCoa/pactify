'use client';

import { useRef, useState, useTransition } from 'react';

import { removeAvatar, updateAvatar, updateDisplayName } from '@/app/profile/actions';
import { Avatar } from '@/components/profile/avatar';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ProfileEditor({
  initialName,
  initialAvatarUrl,
  email,
}: {
  initialName: string;
  initialAvatarUrl: string | null;
  email: string;
}) {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [savingName, startSavingName] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [removing, startRemoving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nameChanged = name.trim() !== initialName.trim();

  function onSaveName() {
    startSavingName(async () => {
      const result = await updateDisplayName(name);
      if (result.ok) {
        showToast('Nombre actualizado.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Elige un archivo de imagen (JPG, PNG, WEBP o GIF).', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast('La imagen pesa demasiado. Máximo 2 MB.', 'error');
      return;
    }

    startUploading(async () => {
      const formData = new FormData();
      formData.append('avatar', file);
      const result = await updateAvatar(formData);
      if (result.ok) {
        setAvatarUrl(result.avatarUrl);
        showToast('Foto actualizada.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  async function onRemoveAvatar() {
    const ok = await confirm({
      title: '¿Eliminar tu foto de perfil?',
      description: 'Volverás a mostrar el círculo con tu inicial. Puedes subir otra cuando quieras.',
      confirmLabel: 'Eliminar foto',
      danger: true,
    });
    if (!ok) return;

    startRemoving(async () => {
      const result = await removeAvatar();
      if (result.ok) {
        setAvatarUrl(null);
        showToast('Foto eliminada.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  return (
    <section className="flex flex-col items-center gap-3 text-center">
      <Avatar name={name || email} avatarUrl={avatarUrl} size="lg" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={uploading || removing}
          onClick={() => fileInputRef.current?.click()}
          className="btn-ghost text-xs"
        >
          {uploading ? 'Subiendo…' : 'Cambiar foto'}
        </button>
        {avatarUrl && (
          <button
            type="button"
            disabled={uploading || removing}
            onClick={onRemoveAvatar}
            className="btn-ghost text-xs text-red-600 hover:text-red-700 dark:text-red-400"
          >
            {removing ? 'Eliminando…' : 'Eliminar foto'}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={onPickFile}
      />

      <div className="flex w-full max-w-xs flex-col gap-2 text-left">
        <label htmlFor="display-name" className="text-xs font-medium text-neutral-500">
          Nombre
        </label>
        <div className="flex gap-2">
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="field"
          />
          <button
            type="button"
            disabled={!nameChanged || name.trim().length === 0 || savingName}
            onClick={onSaveName}
            className="btn-primary shrink-0"
          >
            {savingName ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        <p className="text-sm text-neutral-500">{email}</p>
      </div>
    </section>
  );
}

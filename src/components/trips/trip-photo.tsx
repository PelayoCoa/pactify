'use client';

import { useRef, useState, useTransition } from 'react';

import { removeTripPhoto, updateTripPhoto } from '@/app/trips/actions';
import { Avatar } from '@/components/profile/avatar';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { useToast } from '@/components/ui/toast-provider';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Foto de grupo del viaje: cualquier participante puede cambiarla, no solo el organizador. */
export function TripPhoto({
  tripId,
  tripTitle,
  initialPhotoUrl,
}: {
  tripId: string;
  tripTitle: string;
  initialPhotoUrl: string | null;
}) {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [uploading, startUploading] = useTransition();
  const [removing, startRemoving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Elige un archivo de imagen (JPG, PNG, WEBP o GIF).', 'error');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast('La imagen pesa demasiado. Máximo 2 MB.', 'error');
      return;
    }

    startUploading(async () => {
      const formData = new FormData();
      formData.append('trip_id', tripId);
      formData.append('photo', file);
      const result = await updateTripPhoto(formData);
      if (result.ok) {
        setPhotoUrl(result.photoUrl);
        showToast('Foto del viaje actualizada.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  async function onRemove() {
    const ok = await confirm({
      title: '¿Quitar la foto del viaje?',
      description: 'Volverá a mostrarse el círculo con la inicial. Cualquier participante podrá subir otra.',
      confirmLabel: 'Quitar foto',
      danger: true,
    });
    if (!ok) return;

    startRemoving(async () => {
      const result = await removeTripPhoto(tripId);
      if (result.ok) {
        setPhotoUrl(null);
        showToast('Foto del viaje eliminada.', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={tripTitle} avatarUrl={photoUrl} size="lg" />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={uploading || removing}
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost text-xs"
          >
            {uploading ? 'Subiendo…' : 'Cambiar foto del viaje'}
          </button>
          {photoUrl && (
            <button
              type="button"
              disabled={uploading || removing}
              onClick={onRemove}
              className="btn-ghost text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              {removing ? 'Quitando…' : 'Quitar foto'}
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-400">Cualquier participante puede cambiarla.</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={onPickFile}
      />
    </div>
  );
}

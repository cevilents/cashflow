import { useEffect, useState } from 'react'
import { receiptUrl } from './receiptStorage'
import { Lightbox } from '../ui/Lightbox'
import { Spinner } from '../ui/Spinner'

export function ReceiptLightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    receiptUrl(path).then((url) => setSrc(url ?? null))
  }, [path])
  if (!src) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={onClose}>
        <Spinner size={28} />
      </div>
    )
  }
  return <Lightbox src={src} alt="Bukti transaksi" onClose={onClose} />
}

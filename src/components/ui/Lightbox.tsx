import { X } from 'lucide-react'

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Tutup"
      >
        <X className="h-6 w-6" />
      </button>
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" />
    </div>
  )
}
import { Input } from '@/components/ui/input'

/** The list search box, with an × to clear it (Escape in the box does the same). */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <span className="relative inline-block w-full max-w-xs">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
        }}
        className="pr-8"
      />
      {value && (
        <button
          type="button"
          aria-label="Suche leeren"
          title="Suche leeren (Esc)"
          className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded px-1 hover:bg-slate-100 hover:text-slate-900"
          onClick={() => { onChange(''); }}
        >
          ×
        </button>
      )}
    </span>
  )
}

import { useAdminAuth } from '@/clients/admin/useAdminAuth'
import {
  useEventCategoriesQuery,
  useEventsQuery,
  useHoldersQuery,
  usePermanentNumbersQuery,
  useVariationsQuery,
} from '@/clients/admin/useRegisterQueries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EventNumbers } from '@/components/verwaltung/EventNumbers'
import { Field, Select } from '@/components/verwaltung/fields'
import { MaterialiseCard } from '@/components/verwaltung/MaterialiseCard'
import { NewNumberForm } from '@/components/verwaltung/NewNumberForm'
import { RegisterTable } from '@/components/verwaltung/RegisterTable'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/verwaltung')({
  component: Verwaltung,
})

/**
 * The Dauernummer register for the people who keep it (seller-number-integration.md, idea 2,
 * Stufe 1). Superuser login, one category at a time; edits go straight to the superuser-only
 * collections, the event step through the materialise route.
 */
function Verwaltung() {
  const auth = useAdminAuth()
  return (
    <Card className="m-4 w-full max-w-6xl shadow-md">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Dauernummern-Verwaltung</CardTitle>
        {auth.isSuperuser && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{auth.superuserEmail}</span>
            <Button size="sm" variant="outline" onClick={auth.logout}>
              Abmelden
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>{auth.isSuperuser ? <Register /> : <Login />}</CardContent>
    </Card>
  )
}

function Login() {
  const { login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form
      className="mx-auto max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        login.mutate({ email, password })
      }}
    >
      <p className="text-muted-foreground text-sm">
        Anmeldung mit dem PocketBase-Superuser-Konto. Das Register ist nur damit lesbar.
      </p>
      <Field label="E-Mail">
        <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); }} required autoFocus />
      </Field>
      <Field label="Passwort">
        <Input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); }}
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        Anmelden
      </Button>
    </form>
  )
}

function Register() {
  const categories = useEventCategoriesQuery(true)
  const variations = useVariationsQuery(true)
  const holders = useHoldersQuery(true)
  const numbers = usePermanentNumbersQuery(true)
  const events = useEventsQuery(true)
  const [categoryId, setCategoryId] = useState('')
  const [section, setSection] = useState<'register' | 'new' | 'materialise' | 'event'>('register')

  if (
    !categories.data ||
    !variations.data ||
    !holders.data ||
    !numbers.data ||
    !events.data
  ) {
    return <Skeleton className="h-40 w-full" />
  }

  const selectedCategory = categoryId || categories.data[0]?.id || ''
  const categoryVariations = variations.data.filter((v) => v.eventCategory === selectedCategory)
  const variationIds = new Set(categoryVariations.map((v) => v.id))
  const categoryNumbers = numbers.data.filter((n) => variationIds.has(n.sellerNumberVariation))
  const categoryEvents = events.data.filter((e) => e.eventCategory === selectedCategory)
  const standardVariation =
    categoryVariations.find((v) => /verkaufsnummer/i.test(v.sellerNumberVariationName)) ??
    categoryVariations.at(0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        {/* Two categories today: a toggle reads faster than a dropdown. More than three and
            the dropdown comes back by itself. */}
        {categories.data.length <= 3 ? (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Kategorie</span>
            <div className="flex gap-1 rounded-md border p-1">
              {categories.data.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={selectedCategory === c.id ? 'default' : 'ghost'}
                  onClick={() => { setCategoryId(c.id); }}
                >
                  {c.eventCategoryName}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Field label="Kategorie" className="w-64">
            <Select value={selectedCategory} onChange={(e) => { setCategoryId(e.target.value); }}>
              {categories.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.eventCategoryName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex gap-2">
          {(
            [
              ['register', `Register (${String(categoryNumbers.length)})`],
              ['new', 'Nummer anlegen'],
              ['materialise', 'In ein Event schreiben'],
              ['event', 'Alle Nummern im Event'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={section === key ? 'default' : 'outline'}
              onClick={() => { setSection(key); }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {section === 'register' && (
        <RegisterTable
          key={selectedCategory}
          numbers={categoryNumbers}
          variations={categoryVariations}
          holders={holders.data}
        />
      )}
      {section === 'new' && standardVariation && (
        <NewNumberForm
          key={selectedCategory}
          variations={categoryVariations}
          holders={holders.data}
          defaultVariationId={standardVariation.id}
        />
      )}
      {section === 'materialise' && (
        <MaterialiseCard key={selectedCategory} events={categoryEvents} />
      )}
      {section === 'event' && (
        <EventNumbers
          key={selectedCategory}
          events={categoryEvents}
          variations={categoryVariations}
          registerNumbers={categoryNumbers}
        />
      )}
    </div>
  )
}

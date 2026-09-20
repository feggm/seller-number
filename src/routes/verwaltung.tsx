import { useAdminAuth } from '@/clients/admin/useAdminAuth'
import {
  type EventCategory,
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
import { PoolsOverview } from '@/components/verwaltung/PoolsOverview'
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
  const categories = useEventCategoriesQuery(auth.isSuperuser)
  const [categoryId, setCategoryId] = useState('')
  const selectedCategory = categoryId || (categories.data?.at(0)?.id ?? '')
  return (
    <Card className="m-4 w-full max-w-6xl shadow-md">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <CardTitle>Verkaufsnummer-Verwaltung</CardTitle>
          {auth.isSuperuser && categories.data && (
            <CategoryPicker
              categories={categories.data}
              value={selectedCategory}
              onChange={setCategoryId}
            />
          )}
        </div>
        {auth.isSuperuser && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{auth.superuserEmail}</span>
            <Button size="sm" variant="outline" onClick={auth.logout}>
              Abmelden
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {auth.isSuperuser ? <Register categoryId={selectedCategory} /> : <Login />}
      </CardContent>
    </Card>
  )
}

/** Two categories today: a toggle reads faster than a dropdown. More than three and the
 *  dropdown comes back by itself. */
function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: EventCategory[]
  value: string
  onChange: (id: string) => void
}) {
  if (categories.length <= 3) {
    return (
      <div className="flex gap-1 rounded-md border p-1">
        {categories.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={value === c.id ? 'default' : 'ghost'}
            onClick={() => { onChange(c.id); }}
          >
            {c.eventCategoryName}
          </Button>
        ))}
      </div>
    )
  }
  return (
    <Select value={value} onChange={(e) => { onChange(e.target.value); }} className="w-64">
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.eventCategoryName}
        </option>
      ))}
    </Select>
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

type Section = 'register' | 'new' | 'materialise' | 'event' | 'pools'

function Register({ categoryId }: { categoryId: string }) {
  const categories = useEventCategoriesQuery(true)
  const variations = useVariationsQuery(true)
  const holders = useHoldersQuery(true)
  const numbers = usePermanentNumbersQuery(true)
  const events = useEventsQuery(true)
  const [section, setSection] = useState<Section>('register')

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
  const categoryName = categories.data.find((c) => c.id === selectedCategory)?.eventCategoryName ?? ''
  // Decision 14: the Anziehbar's register is its staff numbers.
  const registerTerm = /anziehbar|azb/i.test(categoryName) ? 'Mitarbeiternummer' : 'Dauernummer'
  const standardVariation =
    categoryVariations.find((v) => /verkaufsnummer/i.test(v.sellerNumberVariationName)) ??
    categoryVariations.at(0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['register', `Dauernummern (${String(categoryNumbers.length)})`],
            ['new', 'Dauernummer anlegen'],
            ['materialise', 'Dauernummern in Event kopieren'],
            ['event', 'Verkäuferliste'],
            ['pools', 'Pools'],
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
          events={categoryEvents}
          defaultVariationId={standardVariation.id}
          registerTerm={registerTerm}
        />
      )}
      {section === 'materialise' && (
        <MaterialiseCard key={selectedCategory} events={categoryEvents} registerTerm={registerTerm} />
      )}
      {section === 'pools' && (
        <PoolsOverview
          key={selectedCategory}
          events={categoryEvents}
          variations={categoryVariations}
          registerTerm={registerTerm}
        />
      )}
      {section === 'event' && (
        <EventNumbers
          key={selectedCategory}
          events={categoryEvents}
          variations={categoryVariations}
          registerNumbers={categoryNumbers}
          registerTerm={registerTerm}
        />
      )}
    </div>
  )
}

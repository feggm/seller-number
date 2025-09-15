import { useSellerNumberRegistrationMutation } from '@/clients/useSellerNumberRegistrationMutation'
import { PageButton } from '@/components/PageButton'
import { CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/context/PageTitleContext'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute(
  '/variation/$variationId/sellerNumber/$sellerNumber/_withSessionCounter/seller-details'
)({
  component: RouteComponent,
})

const SellerFirstNameSchema = z
  .string()
  .min(1, 'Vorname ist erforderlich')
  .trim()
const SellerLastNameSchema = z
  .string()
  .min(1, 'Nachname ist erforderlich')
  .trim()
const SellerEmailSchema = z
  .string()
  .min(1, 'E-Mail ist erforderlich')
  .email('Bitte gib eine gültige E-Mail-Adresse ein')
const SellerPhoneSchema = z.string().refine((value) => {
  if (!value || value.trim().length === 0) return true
  const phoneRegex = /^[0-9\- /+]+$/
  return phoneRegex.test(value)
}, 'Bitte gib eine gültige Telefonnummer ein (nur Zahlen, Leerzeichen, -, / und + sind erlaubt)')

function RouteComponent() {
  usePageTitle('Verkäuferdaten')
  const { sellerNumber } = Route.useParams()
  const router = useRouter()
  const registrationMutation = useSellerNumberRegistrationMutation()

  const form = useForm({
    defaultValues: {
      sellerFirstName: '',
      sellerLastName: '',
      sellerEmail: '',
      sellerPhone: '',
    },
    onSubmit: async ({ value }) => {
      await registrationMutation.mutateAsync({
        sellerNumberId: sellerNumber,
        sellerFirstName: value.sellerFirstName,
        sellerLastName: value.sellerLastName,
        sellerEmail: value.sellerEmail,
        sellerPhone: value.sellerPhone,
      })

      // Navigate to success page or back to main page
      void router.navigate({ to: '/' })
    },
  })

  return (
    <>
      <CardContent className="p-6 space-y-6 overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
          id="seller-details-form"
          className="space-y-6"
        >
          <form.Field
            name="sellerFirstName"
            validators={{
              onBlur: SellerFirstNameSchema,
            }}
          >
            {(field) => (
              <div>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                >
                  Vorname *
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  placeholder="Dein Vorname"
                  className={
                    field.state.meta.errors.length > 0 ? 'border-red-500' : ''
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-red-500 text-sm mt-1">
                    {field.state.meta.errors[0]?.message ?? ''}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="sellerLastName"
            validators={{
              onBlur: SellerLastNameSchema,
            }}
          >
            {(field) => (
              <div>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                >
                  Nachname *
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  placeholder="Dein Nachname"
                  className={
                    field.state.meta.errors.length > 0 ? 'border-red-500' : ''
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-red-500 text-sm mt-1">
                    {field.state.meta.errors[0]?.message ?? ''}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="sellerEmail"
            validators={{
              onBlur: SellerEmailSchema,
            }}
          >
            {(field) => (
              <div>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                >
                  E-Mail *
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  placeholder="deine.email@example.com"
                  className={
                    field.state.meta.errors.length > 0 ? 'border-red-500' : ''
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-red-500 text-sm mt-1">
                    {field.state.meta.errors[0]?.message ?? ''}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="sellerPhone"
            validators={{
              onBlur: SellerPhoneSchema,
            }}
          >
            {(field) => (
              <div>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                >
                  Telefon
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="tel"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                  }}
                  placeholder="+49 123 456789 (optional)"
                  className={
                    field.state.meta.errors.length > 0 ? 'border-red-500' : ''
                  }
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-red-500 text-sm mt-1">
                    {field.state.meta.errors[0]?.message ?? ''}
                  </p>
                )}
              </div>
            )}
          </form.Field>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <PageButton
              type="submit"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              form="seller-details-form"
            >
              REGISTRIEREN
            </PageButton>
          )}
        </form.Subscribe>
      </CardFooter>
    </>
  )
}

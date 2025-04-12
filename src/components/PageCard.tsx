import { Card, CardContent } from './ui/card'

export const PageCard = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  return (
    <Card className="w-full max-w-md overflow-hidden shadow-md border-0">
      <div className="bg-gradient-to-r from-sky-500 to-cyan-400 p-6 -mt-6">
        <h1 className="text-2xl font-medium text-white">{title}</h1>
      </div>

      <CardContent className="p-6 space-y-6">{children}</CardContent>
    </Card>
  )
}

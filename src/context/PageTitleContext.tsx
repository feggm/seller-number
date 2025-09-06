import {
  PropsWithChildren,
  createContext,
  use,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'

type TitleStackItem = {
  title: string
  id: string
}

type PageTitleContextType = {
  setTitleStack: (
    titleStack:
      | TitleStackItem[]
      | ((prev: TitleStackItem[]) => TitleStackItem[])
  ) => void
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(
  undefined
)

export const PageTitleProvider = ({
  children,
  onTitleChange,
}: PropsWithChildren<{
  onTitleChange: (title: string) => void
}>) => {
  const [titleStack, setTitleStack] = useState<TitleStackItem[]>([])
  const contextValue = useMemo(() => ({ setTitleStack }), [setTitleStack])
  useEffect(() => {
    if (titleStack.length)
      onTitleChange(titleStack[titleStack.length - 1].title)
  }, [titleStack, onTitleChange])
  return <PageTitleContext value={contextValue}>{children}</PageTitleContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePageTitle = (title: string) => {
  const context = use(PageTitleContext)
  if (!context)
    throw new Error('usePageTitle must be used within a PageTitleProvider')
  const { setTitleStack } = context

  const id = useId()
  useEffect(() => {
    setTitleStack((prev) => [...prev, { title, id }])
    return () => {
      setTitleStack((prev) => prev.filter((item) => item.id !== id))
    }
  }, [title, id, setTitleStack])
}

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

import { Button } from './ui/button'

type PageButtonProps = Parameters<typeof Button>[0] & {
  counter?: ReactNode
}

export const PageButton = ({
  children,
  counter,
  className,
  ...props
}: PageButtonProps) => {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button
        variant="outline"
        className={cn(
          'relative bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm px-5 py-6 h-auto font-medium uppercase rounded-lg ',
          className
        )}
        {...props}
      >
        {children}
        {counter !== undefined && (
          <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
            {counter}
          </span>
        )}
      </Button>
    </motion.div>
  )
}

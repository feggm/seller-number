import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { ReactNode, useCallback } from 'react'

import { Button } from './ui/button'

type PageButtonProps = Parameters<typeof Button>[0] & {
  counter?: ReactNode
  isLoading?: boolean
}

export const PageButton = ({
  children,
  counter,
  isLoading = false,
  className,
  onClick,
  ...props
}: PageButtonProps) => {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || props.disabled) {
        e.preventDefault()
        return
      }
      onClick?.(e)
    },
    [isLoading, props.disabled, onClick]
  )
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button
        variant="outline"
        disabled={isLoading || props.disabled}
        className={cn(
          'relative bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm px-5 py-6 h-auto font-medium uppercase rounded-lg ',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded opacity-70" />
        )}
        {counter !== undefined && (
          <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
            {counter}
          </span>
        )}
      </Button>
    </motion.div>
  )
}

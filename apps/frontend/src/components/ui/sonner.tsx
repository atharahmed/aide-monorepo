import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group flex items-center gap-2 rounded-[8px] border border-gray-200 bg-white px-3.5 py-3 text-[13px] text-gray-950 shadow-sm',
          description: 'text-gray-500',
          actionButton: 'rounded-[6px] bg-gray-950 px-2 py-1 text-[12px] text-white',
          cancelButton: 'rounded-[6px] bg-gray-100 px-2 py-1 text-[12px] text-gray-700',
          error: 'border-destructive-200 bg-destructive-50 text-destructive-700',
          success: 'border-success-200 bg-success-50 text-success-800',
          warning: 'border-warning-200 bg-warning-50 text-warning-800',
          info: 'border-info-200 bg-info-50 text-info-800',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

import { useState, useEffect, useCallback } from 'react'
import { getCountries, getCountryCallingCode } from 'react-phone-number-input'
import en from 'react-phone-number-input/locale/en.json'
import type { CountryCode } from 'libphonenumber-js'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
}

function PhoneInput({ value, onChange, placeholder = 'Phone number', invalid }: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>('US')
  const [nationalNumber, setNationalNumber] = useState('')

  useEffect(() => {
    if (value && !nationalNumber) {
      const callingCode = getCountryCallingCode(country)
      const prefix = `+${callingCode}`
      if (value.startsWith(prefix)) {
        setNationalNumber(value.slice(prefix.length))
      } else {
        setNationalNumber(value.replace(/^\+\d+/, ''))
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (newCountry: CountryCode, newNational: string) => {
      if (newNational) {
        const digits = newNational.replace(/\D/g, '')
        onChange(`+${getCountryCallingCode(newCountry)}${digits}`)
      } else {
        onChange('')
      }
    },
    [onChange]
  )

  const handleCountryChange = (code: string) => {
    const c = code as CountryCode
    setCountry(c)
    handleChange(c, nationalNumber)
  }

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNationalNumber(event.target.value)
    handleChange(country, event.target.value)
  }

  const countries = getCountries()

  return (
    <div className="flex gap-2">
      <Select value={country} onValueChange={handleCountryChange}>
        <SelectTrigger className={cn("h-9 w-[100px] shrink-0 gap-1 px-2", invalid && "border-destructive-400")}>
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <img
                src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`}
                alt={country}
                className="h-3 w-4 object-cover"
              />
              <span className="text-[13px]">+{getCountryCallingCode(country)}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {countries.map((c) => (
            <SelectItem key={c} value={c}>
              <span className="flex items-center gap-2">
                <img
                  src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${c}.svg`}
                  alt={c}
                  className="h-3 w-4 object-cover"
                />
                <span>{(en as Record<string, string>)[c]}</span>
                <span className="text-gray-400">+{getCountryCallingCode(c)}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        value={nationalNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        className="flex-1"
        aria-invalid={invalid}
      />
    </div>
  )
}

export { PhoneInput }

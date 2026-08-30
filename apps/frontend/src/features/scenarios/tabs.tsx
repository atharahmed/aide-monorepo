import { Link } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ScenariosTabs({ value }: { value: 'scenarios' | 'macros' }) {
  return (
    <Tabs value={value}>
      <TabsList className="flex-nowrap">
        <TabsTrigger value="scenarios" asChild className="text-[11px]">
          <Link to="/scenarios">Scenarios</Link>
        </TabsTrigger>
        <TabsTrigger value="macros" asChild className="text-[11px]">
          <Link to="/scenarios/macros">Macros</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

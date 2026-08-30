import { Link } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function KnowledgeTabs({ value }: { value: 'articles' | 'business' }) {
  return (
    <Tabs value={value}>
      <TabsList className="flex-nowrap">
        <TabsTrigger value="articles" asChild className="text-[11px]">
          <Link to="/knowledge">Articles</Link>
        </TabsTrigger>
        <TabsTrigger value="business" asChild className="text-[11px]">
          <Link to="/knowledge/business-information">Business information</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

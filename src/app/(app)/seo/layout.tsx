import { SectionTabs, PRODUCT_STUDIO_TABS } from "@/components/lens/SectionTabs";

// Import Factory est désormais rangé sous « Product Studio » (onglet Import
// catalogue) — pas une entrée de navigation séparée.
export default function ImportFactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
        Product Studio
      </div>
      <SectionTabs tabs={PRODUCT_STUDIO_TABS} />
      {children}
    </div>
  );
}

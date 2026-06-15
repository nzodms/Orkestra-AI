import { SectionTabs, DATA_LENS_TABS } from "@/components/lens/SectionTabs";

// Orkestra Lens (sourcing & analyse produit) est désormais rangé sous « Data
// Lens » (onglet Sourcing & analyse) — pas une entrée de navigation séparée.
export default function LensLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
        Data Lens
      </div>
      <SectionTabs tabs={DATA_LENS_TABS} />
      {children}
    </div>
  );
}

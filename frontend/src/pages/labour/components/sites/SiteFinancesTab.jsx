import React from 'react';
import MonthlyDetailedMatrix from '../MonthlyDetailedMatrix';

const SiteFinancesTab = ({
    ledgerViewMode,
    setLedgerViewMode,
    selectedSite,
    financeMonth,
    handleOpenAdvance,
    handleOpenPayout,
    financeRoleFilter,
    financeSummary
}) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-150">
            <MonthlyDetailedMatrix
                siteId={selectedSite ? selectedSite.site_id : 'All'}
                month={financeMonth}
                siteName={selectedSite?.site_name}
                onOpenAdvance={handleOpenAdvance}
                onOpenPayout={handleOpenPayout}
                ledgerViewMode={ledgerViewMode}
                setLedgerViewMode={setLedgerViewMode}
                financeSummary={financeSummary}
                selectedSite={selectedSite}
            />
        </div>
    );
};

export default SiteFinancesTab;

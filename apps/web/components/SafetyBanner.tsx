export function SafetyBanner({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <span aria-hidden className="mt-0.5 text-base">⚠️</span>
      <div>
        {children ?? (
          <>
            <strong>Safety:</strong> This tool only customizes visible web-UI
            branding of firmware you own. It never bypasses signatures, unlocks
            accounts, or extracts credentials. Modified firmware{' '}
            <strong>can brick your device</strong> — use a spare ONT and keep the
            original firmware.
          </>
        )}
      </div>
    </div>
  );
}

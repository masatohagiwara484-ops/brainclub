// Mounts the Shop and Paywall overlays once, inside the Layout's relative
// <main> (same spot as FxLayer). Each reads its own open-state from the
// monetization store and renders null when closed, so any component anywhere
// can pop them with monet.openShop() / monet.openPaywall().

import ShopModal from './ShopModal';
import PaywallOverlay from './PaywallOverlay';

export default function MonetizationLayer() {
  return (
    <>
      <ShopModal />
      <PaywallOverlay />
    </>
  );
}

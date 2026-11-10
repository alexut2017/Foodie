import React from 'react';
import Svg, { Path } from 'react-native-svg';

// LocalScout mark: map pin with a fork (same paths as the website logo).
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="240 148 840 840" accessibilityLabel="LocalScout">
      <Path d="M552 795 A239 98 0 1 0 770 795 L751 821 A177 58 0 1 1 570 821 Z" fill="#E34C19" />
      <Path d="M660 157 C515 157 398 275 398 420 C398 470 410 515 430 555 C480 660 590 800 653 881 Q660 888 667 881 C730 800 840 660 890 547 C910 505 920 470 920 420 C920 275 805 157 660 157 Z" fill="#E34C19" />
      <Path d="M567 283 A21 21 0 0 1 609 283 V407 A16 16 0 0 0 641 407 V283 A21.5 21.5 0 0 1 684 283 V407 A16 16 0 0 0 716 407 V283 A21 21 0 0 1 758 283 L764 435 C764 478 735 506 702 507 C697 507 694 510 694 516 V550 L698 670 C698 692 682 708 662 708 C642 708 626 692 626 670 L630 550 V516 C630 510 627 507 622 507 C589 506 561 478 561 435 Z" fill="#FFFFFF" />
    </Svg>
  );
}

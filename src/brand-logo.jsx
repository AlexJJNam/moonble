import React from 'react';

export function BrandLogo({ className = '', decorative = false }) {
  return <img
    className={`mb-brand-wordmark${className ? ` ${className}` : ''}`}
    src="./assets/moonble-wordmark.svg"
    alt={decorative ? '' : 'moonble'}
    aria-hidden={decorative ? 'true' : undefined}
  />;
}

export function HandwritingLogo({ className = '' }) {
  return <svg
    className={`mb-handwriting-wordmark${className ? ` ${className}` : ''}`}
    viewBox="0 0 2172 724"
    role="presentation"
    aria-hidden="true"
  >
    <defs>
      <mask id="moonble-handwriting-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="2172" height="724">
        <rect width="2172" height="724" fill="#000" />
        <g className="mb-handwriting-mask-strokes" fill="none" stroke="#fff" strokeWidth="204" strokeLinecap="round" strokeLinejoin="round">
          <path pathLength="1" d="M96 498 C174 528 205 356 311 356 C398 356 332 522 432 500 C509 483 477 354 568 350 C650 346 598 512 687 501" />
          <path pathLength="1" d="M683 480 C639 409 681 326 775 326 C881 326 907 468 821 503 C724 543 655 459 699 374 C742 291 875 319 900 416" />
          <path pathLength="1" d="M900 460 C882 383 937 326 1024 333 C1127 342 1132 483 1048 513 C951 548 884 459 932 378 C975 306 1095 323 1131 402" />
          <path pathLength="1" d="M1124 412 C1147 454 1146 488 1183 498 C1239 514 1234 362 1321 357 C1413 352 1355 523 1451 498" />
          <path pathLength="1" d="M1439 490 C1500 411 1465 188 1590 148 C1688 117 1727 213 1663 296 C1608 367 1509 398 1497 465" />
          <path pathLength="1" d="M1497 465 C1488 519 1553 542 1601 505 C1651 468 1619 376 1554 390" />
          <path pathLength="1" d="M1600 500 C1687 423 1650 190 1780 150 C1870 122 1915 209 1853 290 C1803 355 1709 401 1704 463" />
          <path pathLength="1" d="M1704 463 C1698 532 1795 541 1848 485 C1897 434 1873 375 1823 393 C1772 411 1790 491 1867 510 C1959 533 2037 476 2091 421" />
        </g>
      </mask>
    </defs>
    <image className="mb-handwriting-wordmark-traced" href="./assets/moonble-wordmark.png" width="2172" height="724" mask="url(#moonble-handwriting-mask)" />
    <image className="mb-handwriting-wordmark-complete" href="./assets/moonble-wordmark.png" width="2172" height="724" />
  </svg>;
}

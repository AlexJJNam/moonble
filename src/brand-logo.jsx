import React from 'react';

const handwritingPaths = [
  { d: 'M96 498 C174 528 205 356 311 356 C398 356 332 522 432 500 C509 483 477 354 568 350 C650 346 598 512 687 501', delay: '0s', duration: '.56s' },
  { d: 'M683 480 C639 409 681 326 775 326 C881 326 907 468 821 503 C724 543 655 459 699 374 C742 291 875 319 900 416', delay: '.46s', duration: '.56s' },
  { d: 'M900 460 C882 383 937 326 1024 333 C1127 342 1132 483 1048 513 C951 548 884 459 932 378 C975 306 1095 323 1131 402', delay: '.92s', duration: '.56s' },
  { d: 'M1124 412 C1147 454 1146 488 1183 498 C1239 514 1234 362 1321 357 C1413 352 1355 523 1451 498', delay: '1.38s', duration: '.56s' },
  { d: 'M1439 490 C1500 411 1465 188 1590 148 C1688 117 1727 213 1663 296 C1608 367 1509 398 1497 465', delay: '1.77s', duration: '.62s' },
  { d: 'M1497 465 C1488 519 1553 542 1601 505 C1651 468 1619 376 1554 390', delay: '2.29s', duration: '.42s' },
  { d: 'M1600 500 C1687 423 1650 190 1780 150 C1870 122 1915 209 1853 290 C1803 355 1709 401 1704 463', delay: '2.61s', duration: '.62s' },
  { d: 'M1704 463 C1698 532 1795 541 1848 485 C1897 434 1873 375 1823 393 C1772 411 1790 491 1867 510 C1959 533 2037 476 2091 421', delay: '3.13s', duration: '.66s' },
];

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
      <linearGradient id="moonble-handwriting-ink" x1="96" y1="0" x2="2091" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4e8df2" />
        <stop offset=".55" stopColor="#3478ea" />
        <stop offset="1" stopColor="#2468df" />
      </linearGradient>
    </defs>
    <g className="mb-handwriting-drawn-strokes" fill="none" stroke="url(#moonble-handwriting-ink)" strokeWidth="104" strokeLinecap="round" strokeLinejoin="round">
      {handwritingPaths.map(({ d, delay, duration }) => <path key={d} pathLength="1" d={d} style={{ '--write-delay': delay, '--write-duration': duration }} />)}
    </g>
    <image className="mb-handwriting-wordmark-complete" href="./assets/moonble-wordmark.png" width="2172" height="724" />
  </svg>;
}

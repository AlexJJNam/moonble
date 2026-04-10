'use strict';

// ===== STOCK LIST TOGGLE =====
function expandStocks(el) {
  var list = el.closest('ul');
  list.classList.remove('collapsed');
  list.classList.add('is-expanding');
  setTimeout(function() {
    list.classList.remove('is-expanding');
    list.classList.add('has-expanded');
  }, 200);
}

// ===== POCKET SELECTION =====
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalIcon = document.getElementById('modalIcon');
const modalClose = document.getElementById('modalClose');
const modalConfirm = document.getElementById('modalConfirm');

const pocketLabels = {
  A: '밸류형 포켓',
  B: '대장주형 포켓',
  C: 'ETF형 포켓'
};

const pocketIconStyle = {
  A: { bg: '#adffc7', color: '#00cf41' },
  B: { bg: '#a0cbff', color: '#0065e1' },
  C: { bg: '#bdb8ff', color: '#6f65ff' }
};

const pocketPages = {
  A: 'pocket-a.html',
  B: 'pocket-b.html',
  C: 'pocket-c.html'
};

let selectedPocket = null;

document.querySelectorAll('.portfolio-btn').forEach(btn => {
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    selectedPocket = this.dataset.pocket;
    const labelColor = pocketIconStyle[selectedPocket].color;
    modalMessage.innerHTML = `<span style="color:${labelColor}">${selectedPocket}.${pocketLabels[selectedPocket]}</span><span style="font-weight:400">을 선택하셨습니다.</span><br><span style="font-weight:400">선택 후 </span><u>중도 변경이 불가능</u><span style="font-weight:400">합니다.</span><br>정말 선택을 확정하시겠습니까?`;
    const s = pocketIconStyle[selectedPocket];
    modalIcon.style.background = s.bg;
    modalIcon.style.color = s.color;
    modalIcon.textContent = selectedPocket;
    modalOverlay.classList.add('active');
  });
});

modalClose.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
  selectedPocket = null;
});

modalConfirm.addEventListener('click', () => {
  if (selectedPocket && pocketPages[selectedPocket]) {
    window.location.href = pocketPages[selectedPocket];
  }
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove('active');
    selectedPocket = null;
  }
});

// ===== SCROLL TO PORTFOLIO (scroll cta) =====
const scrollCta = document.querySelector('.scroll-cta');
if (scrollCta) {
  scrollCta.addEventListener('click', () => {
    document.querySelector('.portfolio-section').scrollIntoView({ behavior: 'smooth' });
  });
}

// ===== SCROLL FADE-IN ANIMATIONS =====
const animatedElements = [
  '.hero-top',
  '.intro-section',
  '.choose-inner',
  '.portfolio-header',
  '.portfolio-card',
];

function observeElements() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  animatedElements.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, i) => {
      el.classList.add('fade-in-up');
      // stagger delay for multiple cards
      if (selector === '.portfolio-card') {
        el.style.transitionDelay = `${i * 0.1}s`;
      }
      observer.observe(el);
    });
  });
}

if ('IntersectionObserver' in window) {
  observeElements();
} else {
  // Fallback: show all immediately
  document.querySelectorAll('.fade-in-up').forEach(el => el.classList.add('visible'));
}

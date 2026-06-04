const BASE = './assets/widget-launcher/';

export const ICON_INSET = {
  help:      '8.33%',
  stock:     '10.42% 9.3% 8.33% 16.67%',
  compare:   '8.33% 0 12.5% 0',
  valuation: '8.33%',
  sentiment: '12.5% 10.42% 14.58% 8.55%',
  screening: '12.34% 8.33% 16.67% 8.33%',
  close:     '22.26%',
  send:      '15% 20%',
  settings:  '7.29% 10.63%',
  chevron:   '37.5% 20.83% 29.17% 20.83%',
};

export const ROWS = [
  { id:'stock',     label:'개별종목 분석',   iconSrc: BASE+'icon-stock.svg',     iconInset: ICON_INSET.stock,     showMode:true,  placeholder:'삼성전자의 투자포인트와 리스크를 정리해줘' },
  { id:'compare',   label:'종목간 비교분석', iconSrc: BASE+'icon-compare.svg',   iconInset: ICON_INSET.compare,   showMode:true,  placeholder:'NAVER와 카카오를 투자매력도 관점에서 비교해줘' },
  { id:'valuation', label:'밸류에이션',      iconSrc: BASE+'icon-valuation.svg', iconInset: ICON_INSET.valuation, showMode:false, placeholder:'삼성전자의 밸류에이션을 분석해줘' },
  { id:'sentiment', label:'마켓 센티멘트',   iconSrc: BASE+'icon-sentiment.svg', iconInset: ICON_INSET.sentiment, showMode:false, placeholder:'주식시장의 투자 센티멘트를 분석해줘' },
  { id:'screening', label:'종목 스크리닝',   iconSrc: BASE+'icon-screening.svg', iconInset: ICON_INSET.screening, showMode:false, placeholder:'원하는 조건에 맞는 종목을 찾아줘' },
];

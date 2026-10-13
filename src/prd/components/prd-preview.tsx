

import type { PrdDocument } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


interface PrdPreviewProps {
  prdData: PrdDocument;
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <section className={`mb-6 break-inside-avoid break-words ${className}`}>
    <h3 className="text-base font-semibold border-b pb-2 mb-3 text-gray-800">{title}</h3>
    <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
  </section>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1">
    {items.map((item, index) => <li key={index}>{item || '...'}</li>)}
  </ul>
);

const hasContent = (data: any) => {
  if (typeof data === 'string') {
    return data.trim() !== '';
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return false;
    
    const firstItem = data[0];
    if (typeof firstItem === 'string') {
      return data.some(item => (item as string).trim() !== '');
    }
    if (typeof firstItem === 'object' && firstItem !== null) {
      if ('asA' in firstItem && 'iWant' in firstItem && 'soThat' in firstItem) { // UserStory
        return data.some(item => (item.asA?.trim() || item.iWant?.trim() || item.soThat?.trim()));
      }
       if ('priority' in firstItem && 'text' in firstItem) { // Requirement
        return data.some(item => item.text?.trim());
      }
      if ('name' in firstItem && 'owner' in firstItem && 'date' in firstItem) { // Milestone
        return data.some(item => item.name?.trim() || item.owner?.trim() || item.date?.trim());
      }
    }
    return true; // Fallback for other array types if any
  }
  return false;
};

export function PrdPreview({ prdData }: PrdPreviewProps) {
  return (
    <div className="w-full max-w-[800px] bg-white rounded-lg overflow-hidden print:shadow-none print:rounded-none">
      <div className="p-10 md:p-12 aspect-[210/297] overflow-y-auto print:aspect-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <header className="flex justify-between items-start mb-8 pb-4 border-b">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{prdData.title}</h1>
            <p className="text-sm md:text-md text-gray-600 mt-2">{prdData.mission}</p>
          </div>
          {prdData.companyLogoUrl && (
            <div className="w-24 h-10 relative shrink-0 ml-4">
              <img 
                data-ai-hint="logo" 
                src={prdData.companyLogoUrl} 
                alt="Company Logo" 
                width={100}
                height={40}
                className="object-contain" 
              />
            </div>
          )}
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8 text-xs md:text-sm">
          <div><strong className="text-gray-600">작성자:</strong> {prdData.author}</div>
          <div><strong className="text-gray-600">문서 버전:</strong> {prdData.version}</div>
          <div><strong className="text-gray-600">최종 수정일:</strong> {prdData.updatedAt}</div>
          {prdData.projectName && <div><strong className="text-gray-600">프로젝트:</strong> {prdData.projectName}</div>}
        </div>
        
        <main>
          {hasContent(prdData.background) && (
            <Section title="1. 배경 및 문제 정의">
              <p className="whitespace-pre-wrap">{prdData.background}</p>
            </Section>
          )}

          {(hasContent(prdData.goals) || hasContent(prdData.successMetrics)) && (
            <Section title="2. 목표 및 성공 지표">
              <div className="grid grid-cols-2 gap-6">
                {hasContent(prdData.goals) && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700">주요 목표 (Goals)</h4>
                    <BulletList items={prdData.goals} />
                  </div>
                )}
                {hasContent(prdData.successMetrics) && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700">성공 지표 (Metrics)</h4>
                    <BulletList items={prdData.successMetrics} />
                  </div>
                )}
              </div>
            </Section>
          )}
          
          {hasContent(prdData.targetUser) && (
             <Section title="3. 타깃 사용자">
                 <p>{prdData.targetUser}</p>
             </Section>
          )}

          {(hasContent(prdData.scopeIn) || hasContent(prdData.scopeOut)) && (
            <Section title="4. 범위 (Scope)">
              <div className="space-y-4">
                {hasContent(prdData.scopeIn) && (
                  <div>
                    <h4 className="font-semibold mb-2">In Scope</h4>
                    <BulletList items={prdData.scopeIn} />
                  </div>
                )}
                {hasContent(prdData.scopeOut) && (
                  <div>
                    <h4 className="font-semibold mb-2">Out of Scope</h4>
                    <BulletList items={prdData.scopeOut} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {hasContent(prdData.userStories) && (
            <Section title="5. 핵심 사용자 시나리오">
              {prdData.userStories.map((story, i) => (
                (story.asA?.trim() || story.iWant?.trim() || story.soThat?.trim()) && (
                  <div key={i} className="mb-2 p-3 bg-gray-50 rounded text-xs md:text-sm break-inside-avoid">
                    <p><strong>As a</strong> {story.asA || '...'}, <strong>I want to</strong> {story.iWant || '...'}, <strong>so that</strong> {story.soThat || '...'}.</p>
                  </div>
                )
              ))}
            </Section>
          )}
          
          {(hasContent(prdData.flowSummary) || hasContent(prdData.acceptanceCriteria)) && (
            <Section title="6. 플로우 및 수용 기준">
               <div className="space-y-4">
                  {hasContent(prdData.flowSummary) && (
                      <div>
                          <h4 className="font-semibold mb-2">플로우 요약</h4>
                          <p className="whitespace-pre-wrap">{prdData.flowSummary}</p>
                      </div>
                  )}
                  {hasContent(prdData.acceptanceCriteria) && (
                      <div>
                          <h4 className="font-semibold mb-2">수용 기준</h4>
                          <BulletList items={prdData.acceptanceCriteria} />
                      </div>
                  )}
              </div>
            </Section>
          )}
          
          {hasContent(prdData.requirements) && (
            <Section title="7. 주요 요구사항">
              <ul className="space-y-1">
                {prdData.requirements.filter(r => r.priority === 'Must').slice(0, 5).map((req, i) => (
                  <li key={`must-${i}`}><Badge variant="destructive" className="mr-2">Must</Badge> {req.text}</li>
                ))}
                {prdData.requirements.filter(r => r.priority === 'Should').slice(0, 3).map((req, i) => (
                  <li key={`should-${i}`}><Badge variant="secondary" className="mr-2">Should</Badge> {req.text}</li>
                ))}
                 {prdData.requirements.filter(r => r.priority === 'Could').slice(0, 2).map((req, i) => (
                  <li key={`could-${i}`}><Badge variant="outline" className="mr-2">Could</Badge> {req.text}</li>
                ))}
              </ul>
               {prdData.requirements.length > 10 && <p className="text-xs text-gray-500 mt-2">... 등 총 {prdData.requirements.length}개 요구사항</p>}
            </Section>
          )}

          {(hasContent(prdData.assumptions) || hasContent(prdData.dependencies) || hasContent(prdData.risks)) && (
            <Section title="8. 리스크 및 의존성">
               <div className="grid grid-cols-2 gap-6">
                  {hasContent(prdData.assumptions) && (
                      <div>
                          <h4 className="font-semibold mb-2">가정</h4>
                          <BulletList items={prdData.assumptions} />
                      </div>
                  )}
                  {hasContent(prdData.dependencies) && (
                      <div>
                          <h4 className="font-semibold mb-2">의존성</h4>
                          <BulletList items={prdData.dependencies} />
                      </div>
                  )}
                  {hasContent(prdData.risks) && (
                      <div className="col-span-2">
                          <h4 className="font-semibold mb-2">리스크</h4>
                          <BulletList items={prdData.risks} />
                      </div>
                  )}
              </div>
            </Section>
          )}
          
          {hasContent(prdData.milestones) && (
            <Section title="9. 주요 마일스톤 및 담당자">
               <div className="space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between font-semibold text-gray-600 border-b pb-1">
                      <span className="w-2/4">마일스톤</span>
                      <span className="w-1/4 text-center">담당자</span>
                      <span className="w-1/4 text-right">예상 일정</span>
                  </div>
                {prdData.milestones.map((ms, i) => (
                  (ms.name?.trim() || ms.owner?.trim() || ms.date?.trim()) && (
                    <div key={i} className="flex justify-between items-center py-1">
                      <span className="w-2/4">{ms.name}</span>
                      <span className="w-1/4 text-center">{ms.owner}</span>
                      <span className="w-1/4 text-right text-gray-500">{ms.date}</span>
                    </div>
                  )
                ))}
              </div>
            </Section>
          )}

          {(hasContent(prdData.northStarMetric) || hasContent(prdData.stakeholders)) && (
             <Section title="10. 주요 지표 및 관계자">
               <div className="grid grid-cols-2 gap-6">
                  {hasContent(prdData.northStarMetric) && (
                      <div>
                          <h4 className="font-semibold mb-2">북극성 지표</h4>
                          <p>{prdData.northStarMetric}</p>
                      </div>
                  )}
                  {hasContent(prdData.stakeholders) && (
                      <div>
                          <h4 className="font-semibold mb-2">스테이크홀더</h4>
                          <p>{prdData.stakeholders.join(', ')}</p>
                      </div>
                  )}
              </div>
            </Section>
          )}
        </main>

        <footer className="text-center text-xs text-gray-400 border-t pt-4 mt-8 print:block">
          {prdData.companyName || 'moonble.'} | CONFIDENTIAL
        </footer>
      </div>
    </div>
  );
}

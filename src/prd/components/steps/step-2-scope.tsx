

import type { PrdDocument } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { RepeatableField } from '../repeatable-field';

interface StepProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

export function Step2Scope({ prdData, onDataChange }: StepProps) {
  const renderDefaultItem = (item: string, onChange: (val: string) => void, onRemove: () => void, placeholder: string) => (
    <div className="flex items-center gap-2">
      <Input value={item} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <RepeatableField
        title="In-Scope (포함 범위)"
        items={prdData.scopeIn}
        updateItems={scopeIn => onDataChange({ scopeIn })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => renderDefaultItem(item, onChange, onRemove, "예: 단계별 PRD 항목 입력 마법사 기능")}
      />
      
      <RepeatableField
        title="Out-of-Scope (제외 범위)"
        items={prdData.scopeOut}
        updateItems={scopeOut => onDataChange({ scopeOut })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => renderDefaultItem(item, onChange, onRemove, "예: 실시간 협업 편집 기능")}
      />

      <RepeatableField
        title="가정 (Assumptions)"
        items={prdData.assumptions}
        updateItems={assumptions => onDataChange({ assumptions })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => renderDefaultItem(item, onChange, onRemove, "예: 사용자는 웹 기반 SaaS 툴 사용에 익숙하다.")}
      />
      
      <RepeatableField
        title="의존성 (Dependencies)"
        items={prdData.dependencies}
        updateItems={dependencies => onDataChange({ dependencies })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => renderDefaultItem(item, onChange, onRemove, "예: PDF 생성을 위한 서버리스 함수")}
      />

      <RepeatableField
        title="리스크 (Risks)"
        items={prdData.risks}
        updateItems={risks => onDataChange({ risks })}
        newItemFactory={() => ""}
        renderItem={(item, onChange, onRemove) => renderDefaultItem(item, onChange, onRemove, "예: AI 모델의 성능이 기대에 미치지 못할 경우")}
      />
    </div>
  );
}

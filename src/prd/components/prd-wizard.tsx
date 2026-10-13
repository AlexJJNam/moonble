

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PrdDocument } from '@/lib/types';
import { Step1BasicInfo } from './steps/step-1-basic-info';
import { Step2Scope } from './steps/step-2-scope';
import { Step3UserScenario } from './steps/step-3-user-scenario';
import { Step4Requirements } from './steps/step-4-requirements';
import { Step5Schedule } from './steps/step-5-schedule';
import { Step6Metrics } from './steps/step-6-metrics';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PrdWizardProps {
  prdData: PrdDocument;
  onDataChange: (updatedData: Partial<PrdDocument>) => void;
}

const steps = [
  { value: 'step-1', label: '기본 정보', component: Step1BasicInfo },
  { value: 'step-2', label: '범위', component: Step2Scope },
  { value: 'step-3', label: '사용자 시나리오', component: Step3UserScenario },
  { value: 'step-4', label: '요구사항', component: Step4Requirements },
  { value: 'step-5', label: '일정 & 리소스', component: Step5Schedule },
  { value: 'step-6', label: '메트릭 & 실험', component: Step6Metrics },
];

export function PrdWizard({ prdData, onDataChange }: PrdWizardProps) {
  const [activeStep, setActiveStep] = React.useState(steps[0].value);
  const isMobile = useIsMobile();

  const activeStepIndex = steps.findIndex(step => step.value === activeStep);
  
  const goToNextStep = () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStep(steps[activeStepIndex + 1].value);
    }
  };

  const goToPrevStep = () => {
    if (activeStepIndex > 0) {
      setActiveStep(steps[activeStepIndex - 1].value);
    }
  };

  const prevStepLabel = activeStepIndex > 0 ? steps[activeStepIndex - 1].label : '';
  const nextStepLabel = activeStepIndex < steps.length - 1 ? steps[activeStepIndex + 1].label : '';

  return (
    <div className="w-full max-w-4xl mx-auto">
        <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full h-full flex flex-col min-h-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm md:-mx-4 px-4 pt-4 -mt-4 mb-4">
            <div className="relative pt-8 pb-4">
               <div className="relative flex justify-between items-center w-full">
                  <div
                      className="absolute left-0 right-0 h-0.5 bg-gray-200 top-[11px]"
                  />
                  <div
                      className="absolute left-0 h-0.5 bg-blue-600 transition-all duration-300 top-[11px]"
                      style={{ width: `calc(${activeStepIndex * (100 / (steps.length -1))}% )` }}
                  />
                  {steps.map((step, index) => {
                      const isCompleted = index < activeStepIndex;
                      const isCurrent = index === activeStepIndex;
                      return (
                          <div key={step.value} className="flex flex-col items-center cursor-pointer group z-10" onClick={() => setActiveStep(step.value)}>
                              <div
                                  className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 bg-background",
                                      isCompleted ? 'bg-blue-600 text-white' : (isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200' : 'bg-gray-300 text-gray-500 group-hover:bg-gray-400')
                                  )}
                              >
                                  {isCompleted ? <Check size={14} /> : index + 1}
                              </div>
                               <div className="hidden md:block mt-2">
                                  <span className={cn(
                                      "text-xs text-center w-20 truncate",
                                      isCurrent ? "font-semibold text-blue-600" : "text-gray-500"
                                  )}>
                                      {step.label}
                                  </span>
                               </div>
                          </div>
                      );
                  })}
              </div>
               <div className="relative flex justify-center items-center text-center mt-4 h-5 px-2 md:hidden">
                  <span className="text-base font-semibold text-blue-600 truncate">{`${activeStepIndex + 1}. ${steps[activeStepIndex].label}`}</span>
              </div>
            </div>
        </div>
        <ScrollArea className="flex-1 md:-mx-4 px-4">
            {steps.map(step => (
            <TabsContent key={step.value} value={step.value} className="space-y-6 p-1">
                <step.component prdData={prdData} onDataChange={onDataChange} />
            </TabsContent>
            ))}
        </ScrollArea>
        <div className="flex justify-between items-center mt-8">
            <Button onClick={goToPrevStep} disabled={activeStepIndex === 0} variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="hidden md:inline">이전으로</span>
            </Button>
            <Button onClick={goToNextStep} disabled={activeStepIndex === steps.length - 1} variant="default">
                <span className="hidden md:inline">다음</span>
                <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            </div>
        </Tabs>
    </div>
  );
}

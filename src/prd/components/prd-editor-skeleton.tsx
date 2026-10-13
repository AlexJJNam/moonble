

import { ArrowLeft, Check, ChevronDown, Clipboard, Eye, FileDown, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PrdEditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <header className="flex items-center justify-between p-4 border-b shrink-0 bg-background">
        <div className="flex items-center gap-4">
           <Button variant="outline" size="icon" disabled>
              <ArrowLeft />
           </Button>
           <div className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <FileText className='h-6 w-6'/>
              </div>
              <span>새로운 PRD</span>
           </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex" disabled><FileDown className="mr-2"/> PDF 내보내기</Button>
          <Button variant="outline" size="sm" className="hidden sm:flex" disabled><Clipboard className="mr-2"/> 마크업 복사</Button>
          <Button variant="default" disabled>
            PRD 등록하기
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="w-full max-w-screen-2xl mx-auto h-full">
          <div className="grid h-full md:grid-cols-2">
            <div className="p-4 md:p-8 w-full">
              <div className="text-sm text-muted-foreground mb-4 max-w-4xl mx-auto">
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Step Tabs Skeleton */}
                <div className="relative flex justify-between items-center w-full py-4">
                    <div
                      className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200"
                    />
                    <div
                      className="absolute top-8 left-0 h-0.5 bg-blue-600 transition-all duration-300"
                      style={{ width: `0%` }}
                    />
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center z-10">
                            <Skeleton className="w-6 h-6 rounded-full" />
                            <Skeleton className="h-4 w-16 mt-2 hidden md:block" />
                        </div>
                    ))}
                </div>
                
                {/* Form Skeleton */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
              </div>
            </div>
            
            <div className="h-full hidden md:block bg-muted/40 p-4 md:p-8 overflow-y-auto">
                <div className="w-full max-w-[800px] bg-white rounded-lg p-10 md:p-12 space-y-8">
                    <header className="flex justify-between items-start pb-4 border-b">
                        <div>
                            <Skeleton className="h-8 w-64 mb-2" />
                            <Skeleton className="h-5 w-full" />
                        </div>
                        <Skeleton className="w-24 h-10 shrink-0 ml-4" />
                    </header>
                    <div className="space-y-4">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 mb-4" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 mb-4" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                     <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 mb-4" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

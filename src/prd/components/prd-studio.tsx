

import { useState, useEffect, Suspense } from 'react';
import type { PrdDocument, User } from '@/lib/types';
import { PrdWizard } from '@/components/prd-wizard';
import { PrdPreview } from '@/components/prd-preview';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from '@/navigation';
import { Button } from './ui/button';
import { Eye, EyeOff, FileDown, Home, ChevronDown, FileText, Check, List, Clipboard, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import isEqual from 'lodash.isequal';
import { Link } from '@/navigation';
import { userStorage } from '@/storage';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { PrdEditorSkeleton } from './prd-editor-skeleton';
import { FlowActionButton } from '../../flow-action-button.jsx';

const createNewPrdObject = (author: User, projectName: string): PrdDocument => ({
  id: '',
  documentId: '',
  title: '새로운 PRD',
  mission: '프로덕트의 미션을 한 줄로 정의해주세요.',
  author: author.name || '',
  authorId: author.id,
  version: '0.1',
  createdAt: new Date().toLocaleDateString('ko-KR'),
  updatedAt: new Date().toLocaleDateString('ko-KR'),
  projectName: projectName,
  companyName: author.companyName || 'moonble.',
  background: '',
  goals: [''],
  targetUser: '',
  successMetrics: [''],
  scopeIn: [''],
  scopeOut: [''],
  assumptions: [''],
  dependencies: [''],
  risks: [''],
  userStories: [{ asA: '', iWant: '', soThat: '' }],
  flowSummary: '',
  acceptanceCriteria: [''],
  requirements: [{ type: 'functional', priority: 'Must', text: '' }],
  milestones: [{ name: '', date: '', owner: '' }],
  stakeholders: [''],
  northStarMetric: '',
  analyticsEvents: [{ event: '', definition: '' }],
  abTests: [],
  tags: [],
  versionNotes: '초기 버전 릴리즈',
  references: [],
  companyLogoUrl: '',
});

export function PrdStudio({ prdId }: { prdId?: string }) {
  const [prdData, setPrdData] = useState<PrdDocument | null>(null);
  const [initialPrdData, setInitialPrdData] = useState<PrdDocument | null>(null);
  const [versionHistory, setVersionHistory] = useState<PrdDocument[]>([]);
  const [isNoChangeAlertOpen, setIsNoChangeAlertOpen] = useState(false);
  const [isSaveSuccessAlertOpen, setIsSaveSuccessAlertOpen] = useState(false);
  const [isUnsavedChangesAlertOpen, setIsUnsavedChangesAlertOpen] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState<{ id: string; version: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isNewPrd, setIsNewPrd] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromVersionId = searchParams.get('fromVersion');

  useEffect(() => {
    const loadData = async () => {
      const currentUserId = userStorage.getItem('prd-currentUser');
      if (!currentUserId) {
        router.push('/');
        return;
      }
      
      const allUsers = JSON.parse(userStorage.getItem('prd-users') || '[]') as User[];
      const currentUser = allUsers.find(u => u.id === currentUserId);
      const isAdmin = false;

      if (!currentUser || !currentUser.name) {
        router.push('/register-name');
        return;
      }

      const prdsFromStorage = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
      let docToLoad: PrdDocument | undefined | null = null;
      let isCreatingNew = false;
      
      const projectNameFromQuery = searchParams.get('projectName');

      if (prdId) { // Editing an existing PRD
        docToLoad = prdsFromStorage.find(p => p.id === prdId);
        if (!docToLoad || (!isAdmin && docToLoad.authorId !== currentUser.id)) {
          router.push('/list'); 
          return;
        }
      } else { // Creating a new PRD
        isCreatingNew = true;
        setIsNewPrd(true);
        
        // Artificial delay for new PRD creation to show skeleton
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (fromVersionId) { // Creating a new version from an existing one
          const basePrd = prdsFromStorage.find(p => p.id === fromVersionId);
          if (!basePrd) {
            router.push('/list');
            return;
          }
          const { id, ...baseData } = basePrd;
          const newVersionNumber = (parseFloat(basePrd.version) + 0.1).toFixed(1);
          docToLoad = {
            ...baseData,
            id: '', // Temporary empty id
            parentId: basePrd.id,
            version: newVersionNumber,
            updatedAt: new Date().toLocaleDateString('ko-KR'),
            createdAt: basePrd.createdAt,
            companyName: currentUser.companyName || 'moonble.',
            versionNotes: `Version ${newVersionNumber} based on v${basePrd.version}`,
          };

        } else { // Creating a brand new document
          docToLoad = createNewPrdObject(currentUser, projectNameFromQuery || '');
        }
      }
      
      if (docToLoad) {
        setPrdData(docToLoad as PrdDocument);
        setInitialPrdData(JSON.parse(JSON.stringify(docToLoad)));

        const history = prdsFromStorage
          .filter(p => p.documentId === (docToLoad as PrdDocument).documentId)
          .sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
        setVersionHistory(history);
      } else if (!isCreatingNew) {
        router.push('/list');
      }
    };
    
    loadData();

  }, [prdId, router, searchParams, fromVersionId]);

  useEffect(() => {
    if (isMobile) {
      setShowPreview(false);
    } else {
      setShowPreview(true);
    }
  }, [isMobile]);

  const handleDataChange = (updatedData: Partial<PrdDocument>) => {
    if (prdData) {
      const newPrdData = { ...prdData, ...updatedData };
      if(!isNewPrd) {
        newPrdData.updatedAt = new Date().toLocaleDateString('ko-KR');
      }
      setPrdData(newPrdData);
    }
  };

  const handleSaveAsNewVersionClick = () => {
    if (!prdData || !initialPrdData) return;
  
    // When creating a new PRD, it always saves.
    if (!isNewPrd) {
       const isInitialVersion = prdData.version === '0.1' && !prdData.parentId;
       const { updatedAt: currentUpdatedAt, ...currentComparable } = prdData;
       const { updatedAt: initialUpdatedAt, ...initialComparable } = initialPrdData;
  
       if (!isInitialVersion && isEqual(currentComparable, initialComparable)) {
         setIsNoChangeAlertOpen(true);
         return;
       }
    }
   
    const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
    
    let newPrd: PrdDocument;

    if (isNewPrd) {
        const newId = `prd-${Date.now()}`;
        newPrd = {
            ...prdData,
            id: newId,
            documentId: prdData.documentId || `doc-${Date.now()}`,
            updatedAt: new Date().toLocaleDateString('ko-KR'),
        };
    } else {
        // This case is for forking a new version from an existing, saved PRD.
        // It's now handled by the /edit/new?fromVersion=... route.
        // This logic remains as a fallback but the button text change makes it less likely.
        const versionHistory = allPrds
          .filter(p => p.documentId === prdData.documentId)
          .sort((a, b) => parseFloat(a.version) - parseFloat(b.version));
      
        const latestVersionInHistory = versionHistory[versionHistory.length - 1] || prdData;
        const newVersionNumber = (parseFloat(latestVersionInHistory.version) + 0.1).toFixed(1);
      
        newPrd = {
          ...prdData,
          id: `prd-${Date.now()}`,
          parentId: latestVersionInHistory.id,
          documentId: latestVersionInHistory.documentId,
          version: newVersionNumber,
          createdAt: prdData.createdAt,
          updatedAt: new Date().toLocaleDateString('ko-KR'),
          versionNotes: `Version ${newVersionNumber} based on v${latestVersionInHistory.version}`
        };
    }
    
    // Save the new version
    allPrds.push(newPrd);
    userStorage.setItem('prds', JSON.stringify(allPrds));

    setNewVersionInfo({ id: newPrd.id, version: newPrd.version });
    setIsSaveSuccessAlertOpen(true);
  };
  
  const handleContinueEditing = () => {
    if (newVersionInfo) {
      setIsSaveSuccessAlertOpen(false);
      
      toast({
        title: `v${newVersionInfo.version} 버전 생성됨`,
        variant: "success",
      });
      
      // If a new PRD was just created, redirect to its new edit page.
      if (isNewPrd) {
        router.replace(`/edit/${newVersionInfo.id}`);
      } else {
        // This case is for forking, should be less common now.
        router.replace(`/edit/${newVersionInfo.id}`, { scroll: false });
        setNewVersionInfo(null);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkup = () => {
    const printableArea = document.getElementById('printable-area');
    if (printableArea) {
      const markup = printableArea.innerHTML;
      navigator.clipboard.writeText(markup)
        .then(() => {
          toast({
            title: "복사 완료",
            description: "마크업이 클립보드에 복사되었습니다.",
            variant: "success",
          });
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          toast({
            title: "복사 실패",
            description: "마크업을 복사하는 데 실패했습니다.",
            variant: "destructive",
          });
        });
    }
  };
  
  const handleTogglePreview = () => {
    setShowPreview(prev => !prev);
  }

  const handleNavigateBack = () => {
    if (!prdData || !initialPrdData) {
      router.push('/list');
      return;
    }
  
    const { updatedAt: currentUpdatedAt, ...currentComparable } = prdData;
    let hasChanges = false;
  
    if (isNewPrd) {
      const currentUserId = userStorage.getItem('prd-currentUser');
      const allUsers = JSON.parse(userStorage.getItem('prd-users') || '[]') as User[];
      const currentUser = allUsers.find(u => u.id === currentUserId);
      if (currentUser) {
        const projectNameFromQuery = searchParams.get('projectName');
        const defaultNewPrd = createNewPrdObject(currentUser, projectNameFromQuery || '');
        const { updatedAt: defaultUpdatedAt, ...defaultComparable } = defaultNewPrd;
        hasChanges = !isEqual(currentComparable, defaultComparable);
      }
    } else {
      const { updatedAt: initialUpdatedAt, ...initialComparable } = initialPrdData;
      hasChanges = !isEqual(currentComparable, initialComparable);
    }
  
    if (hasChanges) {
      setIsUnsavedChangesAlertOpen(true);
    } else {
      router.push('/list');
    }
  };

  const handleUpdateCurrentVersion = () => {
      if (!prdData || !initialPrdData || isNewPrd) return;

      const { updatedAt: currentUpdatedAt, ...currentComparable } = prdData;
      const { updatedAt: initialUpdatedAt, ...initialComparable } = initialPrdData;

      if (isEqual(currentComparable, initialComparable)) {
          toast({ title: "알림", description: "변경된 내용이 없습니다." });
          return;
      }
      
      const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
      const prdIndex = allPrds.findIndex(p => p.id === prdData.id);
      if (prdIndex > -1) {
          const updatedPrd = { ...prdData, updatedAt: new Date().toLocaleDateString('ko-KR') };
          allPrds[prdIndex] = updatedPrd;
          userStorage.setItem('prds', JSON.stringify(allPrds));
          setPrdData(updatedPrd);
          setInitialPrdData(JSON.parse(JSON.stringify(updatedPrd)));
          toast({ title: "저장 완료", description: `v${prdData.version}이(가) 업데이트되었습니다.`, variant: "success" });
      }
  };


  if (!prdData || !initialPrdData) {
    return <PrdEditorSkeleton />;
  }
  
  const NoChangeAlertContent = () => (
    <>
        <AlertDialogHeader>
            <AlertDialogTitle>알림</AlertDialogTitle>
            <AlertDialogDescription>변경 사항이 없으므로 새 버전 저장을 할 수 없습니다.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsNoChangeAlertOpen(false)}>확인</AlertDialogAction>
        </AlertDialogFooter>
    </>
  );

  const SaveSuccessAlertContent = () => (
    <>
      <AlertDialogHeader className="items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
        <AlertDialogTitle>{`v${newVersionInfo?.version}이(가) 성공적으로 생성되었습니다.`}</AlertDialogTitle>
        <AlertDialogDescription>이어서 편집할 경우 자동으로 다음 버전으로 작성됩니다.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => router.push('/list')}>목록으로</AlertDialogCancel>
        <AlertDialogAction onClick={handleContinueEditing}>이어서 편집</AlertDialogAction>
      </AlertDialogFooter>
    </>
  );

  const saveButtonText = (isNewPrd && !fromVersionId) ? 'PRD 등록하기' : '새 버전으로 저장';

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-muted/40 no-print">
        <header className="flex items-center justify-between p-4 border-b shrink-0 bg-background w-full no-print">
          <div className="flex items-center gap-4 overflow-hidden">
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleNavigateBack}>
                        <ArrowLeft />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>목록으로</p></TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 text-lg font-semibold overflow-hidden">
               <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                <FileText className='h-6 w-6'/>
              </div>
              <h1 className="truncate">{prdData.title}</h1>
               {versionHistory.length > 0 && !isNewPrd && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 shrink-0">
                      v{prdData.version}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {versionHistory.map((versionDoc) => (
                      <DropdownMenuItem
                        key={versionDoc.id}
                        onClick={() => router.push(`/edit/${versionDoc.id}`)}
                        disabled={versionDoc.id === prdData.id}
                      >
                        v{versionDoc.version} ({versionDoc.updatedAt} by {versionDoc.author})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden sm:flex"><FileDown /> PDF 내보내기</Button>
            <Button variant="outline" size="sm" onClick={handleCopyMarkup} className="hidden sm:flex"><Clipboard /> 마크업 복사</Button>
            {!isNewPrd && <Button variant="outline" size="sm" onClick={handleUpdateCurrentVersion}>현재 버전 저장</Button>}
            <FlowActionButton onClick={handleSaveAsNewVersionClick}>
              {saveButtonText}
            </FlowActionButton>
          </div>
        </header>

        <main className="prd-studio-main flex-1 overflow-auto no-print">
          <div className="w-full max-w-screen-2xl mx-auto h-full">
            <div className={cn(
                "grid h-full",
                showPreview && !isMobile ? "md:grid-cols-2" : "grid-cols-1"
              )}>
              <div className="p-4 md:p-8 w-full">
                  <div className="text-sm text-muted-foreground mb-4 max-w-4xl mx-auto">
                      <span>문서 버전: {prdData.version}</span>
                      <span className="mx-2">|</span>
                      <span>생성일: {prdData.createdAt}</span>
                      <span className="mx-2">|</span>
                      <span>최종 수정일: {prdData.updatedAt}</span>
                  </div>
                  <div className="max-w-4xl mx-auto">
                    <PrdWizard prdData={prdData} onDataChange={handleDataChange} />
                  </div>
              </div>
              
              <div className={cn(
                  "h-full hidden md:block bg-muted/40 p-4 md:p-8 overflow-y-auto transition-transform duration-300 ease-in-out",
                  showPreview ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
                  !showPreview && "hidden"
                )}>
                   <PrdPreview prdData={prdData} />
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {isMobile ? (
        <Sheet open={showPreview} onOpenChange={setShowPreview}>
          <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col no-print">
              <SheetHeader className='p-4 border-b'>
                <SheetTitle>미리보기</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto flex-1 print-only" id="printable-area-mobile">
                <PrdPreview prdData={prdData} />
              </div>
              <SheetFooter className="p-4 border-t bg-background flex-row justify-end gap-2">
                <Button onClick={handlePrint} variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4"/> PDF 출력</Button>
                <Button onClick={handleCopyMarkup} variant="outline" size="sm"><Clipboard className="mr-2 h-4 w-4"/> 마크업 복사</Button>
                <Button onClick={() => setShowPreview(false)} variant="default" className="w-fit">
                    <Check className="mr-2 h-4 w-4" /> 확인
                </Button>
              </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={handleTogglePreview}
            className="fixed bottom-8 right-8 rounded-full shadow-lg z-20 flex no-print"
            aria-label="Toggle Preview"
          >
            {showPreview ? <EyeOff /> : <Eye />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showPreview ? '미리보기 숨기기' : '미리보기 보이기'}</p>
        </TooltipContent>
      </Tooltip>


      <div id="printable-area" className="hidden print-only">
        <PrdPreview prdData={prdData} />
      </div>
      
      <AlertDialog open={isUnsavedChangesAlertOpen} onOpenChange={setIsUnsavedChangesAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>확인</AlertDialogTitle>
            <AlertDialogDescription>
              변경사항이 저장되지 않을 수 있습니다. 정말로 나가시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsUnsavedChangesAlertOpen(false)}>계속 편집</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push('/list')}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMobile ? (
        <Sheet open={isNoChangeAlertOpen || isSaveSuccessAlertOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
              setIsNoChangeAlertOpen(false);
              setIsSaveSuccessAlertOpen(false);
            }
        }}>
            <SheetContent side="bottom">
                {isNoChangeAlertOpen && (
                   <>
                    <SheetHeader>
                      <SheetTitle>알림</SheetTitle>
                      <AlertDialogDescription>변경 사항이 없으므로 새 버전 저장을 할 수 없습니다.</AlertDialogDescription>
                    </SheetHeader>
                    <SheetFooter className="pt-4">
                      <Button onClick={() => setIsNoChangeAlertOpen(false)} className="w-full">확인</Button>
                    </SheetFooter>
                   </>
                )}
                {isSaveSuccessAlertOpen && (
                   <>
                    <SheetHeader className="items-center text-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                        <SheetTitle>{`v${newVersionInfo?.version}이(가) 성공적으로 생성되었습니다.`}</SheetTitle>
                        <AlertDialogDescription>이어서 편집할 경우 자동으로 다음 버전으로 작성됩니다.</AlertDialogDescription>
                    </SheetHeader>
                    <SheetFooter className="grid grid-cols-2 gap-2 pt-4">
                        <Button onClick={() => router.push('/list')} variant="outline">목록으로</Button>
                        <Button onClick={handleContinueEditing}>이어서 편집</Button>
                    </SheetFooter>
                   </>
                )}
            </SheetContent>
        </Sheet>
      ) : (
        <>
            <AlertDialog open={isNoChangeAlertOpen} onOpenChange={setIsNoChangeAlertOpen}>
                <AlertDialogContent>
                    <NoChangeAlertContent />
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isSaveSuccessAlertOpen} onOpenChange={setIsSaveSuccessAlertOpen}>
                <AlertDialogContent>
                    <SaveSuccessAlertContent />
                </AlertDialogContent>
            </AlertDialog>
        </>
      )}

    </TooltipProvider>
  );
}



import React, { useState, useEffect, useMemo, Fragment, useCallback } from 'react';
import { useRouter } from '@/navigation';
import { userStorage } from '@/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, LogOut, GitBranchPlus, User as UserIcon, ShieldAlert, Trash2, Info, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderPlus, FolderKanban, Pencil, Check, X, MoreVertical, FileText, Search, Star, FileDown } from 'lucide-react';
import type { PrdDocument, User, Project } from '@/lib/types';
import { Link } from '@/navigation';
import { Badge } from '@/components/ui/badge';
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
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from '@/components/ui/sheet';
import { PrdPreview } from '@/components/prd-preview';
import { FlowActionButton } from '../../../flow-action-button.jsx';


const MAX_VERSIONS_VISIBLE = 10;
const ITEMS_PER_PAGE = 10;

type GroupedPrds = { [documentId: string]: PrdDocument[] };

type DeletedItemInfo = {
  item: PrdDocument;
  isGroupDelete: boolean;
};

const FirstProjectDialogContent = React.memo(({ open, onOpenChange, value, onChange, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="prd-action-dialog" overlayClassName="prd-action-overlay" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>첫 프로젝트 생성</DialogTitle>
        <DialogDescription>
            첫 PRD를 만들기 전에, 첫 프로젝트의 이름을 정해주세요. 이 프로젝트는 삭제할 수 없습니다. (10자 이내)
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
          <Label htmlFor="first-project-name">프로젝트 이름</Label>
          <Input
            id="first-project-name"
            value={value}
            onChange={onChange}
            onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    onSubmit();
                }
            }}
            maxLength={10}
            placeholder="나의 첫 프로젝트 이름을 입력해 주세요."
          />
      </div>
      <DialogFooter>
        <Button onClick={onSubmit}>생성하고 시작하기</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
));
FirstProjectDialogContent.displayName = 'FirstProjectDialogContent';


const ProjectManagementDialogContent = React.memo(({
    projects,
    hiddenProjects,
    justRestoredProjects,
    editingProjectId,
    editingProjectName,
    setEditingProjectName,
    onUpdateProjectName,
    onEditProject,
    onCancelEdit,
    onSetProjectToDelete,
    newProjectName,
    onNewProjectNameChange,
    onAddNewProject,
}: {
    projects: Project[];
    hiddenProjects: Set<string>;
    justRestoredProjects: Set<string>;
    editingProjectId: string | null;
    editingProjectName: string;
    setEditingProjectName: (name: string) => void;
    onUpdateProjectName: () => void;
    onEditProject: (project: Project) => void;
    onCancelEdit: () => void;
    onSetProjectToDelete: (project: Project | null) => void;
    newProjectName: string;
    onNewProjectNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAddNewProject: () => void;
}) => {
    return (
    <>
      <DialogHeader>
          <DialogTitle>프로젝트 관리</DialogTitle>
          <DialogDescription>
              프로젝트를 추가, 수정, 삭제할 수 있습니다. (10자 이내)
          </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4 max-h-[400px] overflow-y-auto pr-2">
          {projects.length > 0 ? projects.filter(p => !hiddenProjects.has(p.id)).map((project, index) => {
              const isRestoring = justRestoredProjects.has(project.id);
              return (
              <div key={project.id} className={cn("flex items-center gap-2", isRestoring && "animate-slide-in")}>
                  {editingProjectId === project.id ? (
                      <>
                          <Input
                              value={editingProjectName}
                              onChange={(e) => setEditingProjectName(e.target.value)}
                              className="flex-grow"
                              maxLength={10}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                      onUpdateProjectName();
                                  }
                              }}
                          />
                          <Button size="icon" variant="ghost" onClick={onUpdateProjectName}><Check className="h-4 w-4 text-green-600"/></Button>
                          <Button size="icon" variant="ghost" onClick={onCancelEdit}><X className="h-4 w-4 text-red-600"/></Button>
                      </>
                  ) : (
                      <>
                          <span className="flex-grow p-2">{project.name}</span>
                          <Button size="icon" variant="ghost" onClick={() => onEditProject(project)}><Pencil className="h-4 w-4"/></Button>
                          {index !== 0 && (
                            <Button size="icon" variant="ghost" onClick={() => onSetProjectToDelete(project)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                          )}
                      </>
                  )}
              </div>
          )}) : (
              <p className="text-sm text-center text-muted-foreground">프로젝트가 없습니다.</p>
          )}
      </div>
      <DialogFooter className="border-t pt-4">
            <div className="flex w-full gap-2">
              <Input
                  placeholder="새 프로젝트 이름 (10자 이내)"
                  value={newProjectName}
                  maxLength={10}
                  onChange={onNewProjectNameChange}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          onAddNewProject();
                      }
                  }}
              />
              <Button type="button" onClick={onAddNewProject}>
                  <Plus className="mr-2 h-4 w-4"/>추가
              </Button>
          </div>
      </DialogFooter>
    </>
    );
});
ProjectManagementDialogContent.displayName = 'ProjectManagementDialogContent';


export default function PrdListPage() {
  const [groupedPrds, setGroupedPrds] = useState<GroupedPrds>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DeletedItemInfo | null>(null);
  
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [justRestored, setJustRestored] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isProjectManagementOpen, setIsProjectManagementOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set());
  const [justRestoredProjects, setJustRestoredProjects] = useState<Set<string>>(new Set());
  
  const [isNewPrdDialogOpen, setIsNewPrdDialogOpen] = useState(false);
  const [openedFromNewPrdFlow, setOpenedFromNewPrdFlow] = useState(false);
  const [isFirstProjectDialogOpen, setIsFirstProjectDialogOpen] = useState(false);
  const [firstProjectName, setFirstProjectName] = useState('');
  const [newPrdSelectedProjectName, setNewPrdSelectedProjectName] = useState('');
  


  
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());
  const [justFavorited, setJustFavorited] = useState<Set<string>>(new Set());

  const [prdToPrint, setPrdToPrint] = useState<PrdDocument | null>(null);

  useEffect(() => {
    if (!isMobile || !(isProjectManagementOpen || isNewPrdDialogOpen || isFirstProjectDialogOpen)) return undefined;
    const viewport = window.visualViewport;
    let frame = 0;
    const placeAboveKeyboard = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const keyboardOffset = viewport
          ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
          : 0;
        document.querySelectorAll<HTMLElement>('.prd-action-dialog').forEach(dialog => {
          dialog.style.setProperty('--prd-keyboard-offset', `${keyboardOffset}px`);
          const focusedField = dialog.querySelector<HTMLElement>('input:focus, textarea:focus, select:focus');
          if (focusedField) {
            const rect = focusedField.getBoundingClientRect();
            const visibleBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 12;
            if (rect.bottom > visibleBottom) focusedField.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
      });
    };
    placeAboveKeyboard();
    viewport?.addEventListener('resize', placeAboveKeyboard);
    viewport?.addEventListener('scroll', placeAboveKeyboard);
    document.addEventListener('focusin', placeAboveKeyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', placeAboveKeyboard);
      viewport?.removeEventListener('scroll', placeAboveKeyboard);
      document.removeEventListener('focusin', placeAboveKeyboard);
    };
  }, [isMobile, isProjectManagementOpen, isNewPrdDialogOpen, isFirstProjectDialogOpen]);

  useEffect(() => {
    if (prdToPrint) {
      const timer = setTimeout(() => {
        window.print();
        setPrdToPrint(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prdToPrint]);

  const handlePrintPrd = (prd: PrdDocument) => {
    setPrdToPrint(prd);
  };


  useEffect(() => {
    const currentUserId = userStorage.getItem('prd-currentUser');
    if (!currentUserId) {
      router.push('/');
      return;
    }

    const allUsers = JSON.parse(userStorage.getItem('prd-users') || '[]') as User[];
    const user = allUsers.find(u => u.id === currentUserId);
    const adminStatus = false;
    
    if (!user) {
      router.push('/');
      return;
    }
    
    if (!user.name) {
      router.push('/register-name');
      return;
    }
    
    setCurrentUser(user);
    setIsAdmin(adminStatus);
    
    const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
    
    const allProjects = JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[];
    const userProjects = allProjects.filter(p => p.userId === user.id);

    setProjects(userProjects);
    if(userProjects.length > 0) {
      setNewPrdSelectedProjectName(userProjects[0].name);
    }

    const prdsToShow = adminStatus ? allPrds : allPrds.filter(prd => prd.authorId === user.id);
    
    const grouped = prdsToShow.reduce((acc, prd) => {
      const key = prd.documentId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(prd);
      return acc;
    }, {} as GroupedPrds);

    for (const key in grouped) {
      grouped[key].sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
    }

    setGroupedPrds(grouped);
    
  }, [router]);
  
  const createNewPrd = useCallback((projectName: string) => {
    if (!currentUser?.name || !currentUser?.id) return;
    
    if (!projectName) {
        toast({ title: "오류", description: "PRD를 추가할 프로젝트를 선택해주세요.", variant: "destructive" });
        return;
    }
    
    setIsNewPrdDialogOpen(false);
    if(projects.length > 0) {
      setNewPrdSelectedProjectName(projects[0].name);
    }
    router.push(`/edit/new?projectName=${encodeURIComponent(projectName)}`);
  }, [currentUser, projects, router, toast]);

  const handleAddNewProject = useCallback(() => {
    const trimmedNewProjectName = newProjectName.trim();
    if (!trimmedNewProjectName) {
        toast({ title: "오류", description: "프로젝트 이름을 입력해주세요.", variant: "destructive" });
        return;
    }
    if (trimmedNewProjectName.length > 10) {
        toast({ title: "오류", description: "프로젝트 이름은 10자 이내로 입력해주세요.", variant: "destructive" });
        return;
    }
    if (projects.some(p => p.name === trimmedNewProjectName)) {
        toast({ title: "오류", description: "이미 존재하는 프로젝트 이름입니다.", variant: "destructive" });
        return;
    }
    if (!currentUser) return;

    const newProject: Project = { 
      id: `proj-${Date.now()}`, 
      name: trimmedNewProjectName,
      userId: currentUser.id
    };
    
    const allProjects = JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[];
    const updatedAllProjects = [...allProjects, newProject];
    userStorage.setItem('prd-projects', JSON.stringify(updatedAllProjects));
    
    const updatedUserProjects = [...projects, newProject];
    setProjects(updatedUserProjects);
    
    setNewProjectName('');
    toast({ 
      title: "프로젝트 생성 완료!", 
      description: `"${trimmedNewProjectName}" 프로젝트로 PRD를 작성하시겠어요?`,
      action: <ToastAction altText="작성하기" onClick={() => createNewPrd(trimmedNewProjectName)}>작성하기</ToastAction>,
      duration: 8000,
    });
  }, [newProjectName, projects, currentUser, toast, createNewPrd]);
  
  const handleEditProject = useCallback((project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingProjectId(null);
    setEditingProjectName('');
  }, []);
  
  const handleUpdateProjectName = useCallback(() => {
    if (!editingProjectId || !editingProjectName.trim()) return;

    if (editingProjectName.trim().length > 10) {
        toast({ title: "오류", description: "프로젝트 이름은 10자 이내로 입력해주세요.", variant: "destructive" });
        return;
    }

    const oldProject = projects.find(p => p.id === editingProjectId);
    if (!oldProject) return;

    if (projects.some(p => p.name === editingProjectName.trim() && p.id !== editingProjectId)) {
      toast({ title: "오류", description: "이미 존재하는 프로젝트 이름입니다.", variant: "destructive" });
      return;
    }

    const updatedProjects = projects.map(p => 
      p.id === editingProjectId ? { ...p, name: editingProjectName.trim() } : p
    );
    setProjects(updatedProjects);
    
    const allProjects = JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[];
    const updatedAllProjects = allProjects.map(p => 
      p.id === editingProjectId ? { ...p, name: editingProjectName.trim() } : p
    );
    userStorage.setItem('prd-projects', JSON.stringify(updatedAllProjects));

    const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
    const updatedPrds = allPrds.map(prd => 
      prd.projectName === oldProject.name && prd.authorId === currentUser?.id
      ? { ...prd, projectName: editingProjectName.trim() } : prd
    );
    userStorage.setItem('prds', JSON.stringify(updatedPrds));
    
    const prdsToShow = isAdmin ? updatedPrds : updatedPrds.filter(prd => prd.authorId === currentUser?.id);
     const grouped = prdsToShow.reduce((acc, prd) => {
      const key = prd.documentId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(prd);
      return acc;
    }, {} as GroupedPrds);
     for (const key in grouped) {
      grouped[key].sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
    }
    setGroupedPrds(grouped);


    if (selectedProject === oldProject.name) {
        setSelectedProject(editingProjectName.trim());
    }

    setEditingProjectId(null);
    setEditingProjectName('');
    toast({ title: "성공", description: "프로젝트 이름이 변경되었습니다." });
  }, [editingProjectId, editingProjectName, projects, currentUser, isAdmin, selectedProject, toast]);

  const handleDeleteProject = (project: Project) => {
    const key = project.id;
    setHiddenProjects(prev => new Set(prev).add(key));

    const persistDelete = () => {
      setProjects(prevProjects => prevProjects.filter(p => p.id !== project.id));
      const currentProjects = JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[];
      const updatedProjects = currentProjects.filter(p => p.id !== project.id);
      userStorage.setItem('prd-projects', JSON.stringify(updatedProjects));

      const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
      const updatedPrds = allPrds.map(prd => 
          prd.projectName === project.name && prd.authorId === currentUser?.id
          ? { ...prd, projectName: '' } : prd
      );
      userStorage.setItem('prds', JSON.stringify(updatedPrds));
      
      const prdsToShow = isAdmin ? updatedPrds : updatedPrds.filter(prd => prd.authorId === currentUser?.id);
      const grouped = prdsToShow.reduce((acc, prd) => {
        const key = prd.documentId;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(prd);
        return acc;
      }, {} as GroupedPrds);
      for (const groupKey in grouped) {
        grouped[groupKey].sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
      }
      setGroupedPrds(grouped);

      if (selectedProject === project.name) {
          setSelectedProject('all');
      }
    };
    
    const undoDelete = () => {
        setHiddenProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
        });
        setJustRestoredProjects(prev => new Set(prev).add(key));
        setTimeout(() => {
             setJustRestoredProjects(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }, 500);
    };

    toast({
        title: `"${project.name}" 프로젝트가 삭제되었습니다.`,
        description: "실수로 삭제하셨나요?",
        action: <ToastAction altText="삭제취소" onClick={undoDelete}>삭제취소</ToastAction>,
        duration: 5000,
        onDismiss: () => {
             setHiddenProjects(prev => {
                if (prev.has(key)) {
                    persistDelete();
                }
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        },
        onAutoClose: () => {
             setHiddenProjects(prev => {
                if (prev.has(key)) {
                    persistDelete();
                }
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }
    });
  }


  const stats = useMemo(() => {
    const prdsInView = Object.fromEntries(
        Object.entries(groupedPrds).filter(([key]) => !hiddenItems.has(key))
    );

    const totalDocs = Object.keys(prdsInView).length;
    if (totalDocs === 0) {
      return { totalDocs: 0, avgVersions: 0 };
    }
    const totalVersions = Object.values(prdsInView).flat().filter(p => !hiddenItems.has(p.id)).length;
    const avgVersions = (totalVersions / totalDocs).toFixed(1);
    return { totalDocs, avgVersions };
  }, [groupedPrds, hiddenItems]);


  const handleOpenNewPrdDialog = () => {
    if (projects.length === 0) {
        setIsFirstProjectDialogOpen(true);
    } else {
        if (selectedProject !== 'all') {
            setNewPrdSelectedProjectName(selectedProject);
        } else {
            setNewPrdSelectedProjectName(projects[0]?.name || '');
        }
        setIsNewPrdDialogOpen(true);
    }
  };

  const handleCreateFirstProjectAndPrd = () => {
      const name = firstProjectName.trim();
      if (!name) {
          toast({ title: "오류", description: "프로젝트 이름을 입력해주세요.", variant: "destructive" });
          return;
      }
      if (name.length > 10) {
          toast({ title: "오류", description: "프로젝트 이름은 10자 이내로 입력해주세요.", variant: "destructive" });
          return;
      }
      if (!currentUser) return;

      const newProject: Project = { id: `proj-${Date.now()}`, name, userId: currentUser.id };
      
      const allProjects = JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[];
      const updatedAllProjects = [...allProjects, newProject];
      userStorage.setItem('prd-projects', JSON.stringify(updatedAllProjects));

      setProjects([newProject]);

      createNewPrd(name);
      setIsFirstProjectDialogOpen(false);
      setFirstProjectName('');
  };
  
  const createNewVersion = (basePrd: PrdDocument) => {
    router.push(`/edit/new?fromVersion=${basePrd.id}`);
  };

  const requestDeletePrd = (prd: PrdDocument, isGroupDelete: boolean) => {
    setItemToDelete({ item: prd, isGroupDelete });
    const isLastVersion = groupedPrds[prd.documentId]?.filter(p => !hiddenItems.has(p.id)).length === 1;

    if (isGroupDelete || isLastVersion) {
      setShowFinalDeleteConfirm(true);
    } else {
      setIsDeleteDialogOpen(true);
    }
  };
  
  const confirmDelete = () => {
    if (!itemToDelete) return;
    handleDeleteItem(itemToDelete.item, itemToDelete.isGroupDelete);
    closeDeleteDialog();
  };

  const handleDeleteItem = (deletedItem: PrdDocument, isGroupDelete: boolean) => {
    const key = isGroupDelete ? deletedItem.documentId : deletedItem.id;
    setHiddenItems(prev => new Set(prev).add(key));

    const persistDelete = () => {
        let allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
        let prdsToKeep;
        if (isGroupDelete) {
            prdsToKeep = allPrds.filter(p => p.documentId !== deletedItem.documentId);
        } else {
            prdsToKeep = allPrds.filter(p => p.id !== deletedItem.id);
        }
        userStorage.setItem('prds', JSON.stringify(prdsToKeep));
        setGroupedPrds((prev) => {
            if (isGroupDelete) {
                const newGroupedPrds = { ...prev };
                delete newGroupedPrds[deletedItem.documentId];
                return newGroupedPrds;
            } else {
                 const updatedGroup = (prev[deletedItem.documentId] || []).filter(
                    (p) => p.id !== deletedItem.id
                );
                if (updatedGroup.length > 0) {
                    return { ...prev, [deletedItem.documentId]: updatedGroup };
                } else {
                    const newGroupedPrds = { ...prev };
                    delete newGroupedPrds[deletedItem.documentId];
                    return newGroupedPrds;
                }
            }
        });
    };

    const undoDelete = () => {
        setHiddenItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
        });
        setJustRestored(prev => new Set(prev).add(key));
        setTimeout(() => {
             setJustRestored(prev => {
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }, 500);
    };

    toast({
        title: isGroupDelete ? "문서가 삭제되었습니다." : `v${deletedItem.version} 버전이 삭제되었습니다.`,
        description: "실수로 삭제하셨나요?",
        action: <ToastAction altText="삭제취소" onClick={undoDelete}>삭제취소</ToastAction>,
        duration: 5000,
        onDismiss: () => {
            setHiddenItems(prev => {
                if (prev.has(key)) {
                    persistDelete();
                }
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        },
        onAutoClose: () => {
            setHiddenItems(prev => {
                if (prev.has(key)) {
                    persistDelete();
                }
                const newSet = new Set(prev);
                newSet.delete(key);
                return newSet;
            });
        }
    });
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setShowFinalDeleteConfirm(false);
    setItemToDelete(null);
  };


  const toggleGroupExpansion = (documentId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };
  
  const handleToggleFavorite = (documentId: string) => {
    const isCurrentlyFavorite = groupedPrds[documentId]?.[0]?.isFavorite ?? false;
    const newFavoriteStatus = !isCurrentlyFavorite;

    toast({
      title: newFavoriteStatus ? "즐겨찾기에 추가했습니다." : "즐겨찾기에서 해제했습니다.",
      description: `"${groupedPrds[documentId][0].title}"`,
      variant: "success",
    });

    if (newFavoriteStatus) {
        setJustFavorited(prev => new Set(prev).add(documentId));
        setTimeout(() => setJustFavorited(prev => {
            const newSet = new Set(prev);
            newSet.delete(documentId);
            return newSet;
        }), 500);
    } else {
        setAnimatingOut(prev => new Set(prev).add(documentId));
    }
    
    // Update local storage first
    const allPrds = JSON.parse(userStorage.getItem('prds') || '[]') as PrdDocument[];
    const updatedPrds = allPrds.map(prd => {
      if (prd.documentId === documentId) {
        return { ...prd, isFavorite: newFavoriteStatus };
      }
      return prd;
    });
    userStorage.setItem('prds', JSON.stringify(updatedPrds));

    // Then update state for re-render
    const animationDelay = newFavoriteStatus ? 0 : 500;
    
    setTimeout(() => {
        const updatedGroupedPrds = { ...groupedPrds };
        if (updatedGroupedPrds[documentId]) {
            updatedGroupedPrds[documentId] = updatedGroupedPrds[documentId].map(prd => ({ ...prd, isFavorite: newFavoriteStatus }));
            setGroupedPrds(updatedGroupedPrds);
        }

        if (!newFavoriteStatus) {
            setAnimatingOut(prev => {
                const newSet = new Set(prev);
                newSet.delete(documentId);
                return newSet;
            });
        }
    }, animationDelay);
  };

  const handleProjectManagementOpenChange = useCallback((isOpen: boolean) => {
    setIsProjectManagementOpen(isOpen);
    if (!isOpen) {
      if (openedFromNewPrdFlow) {
        const timer = setTimeout(() => {
            const projectsExist = (JSON.parse(userStorage.getItem('prd-projects') || '[]') as Project[]).filter(p => p.userId === currentUser?.id).length > 0;
            if (projectsExist) {
                setIsNewPrdDialogOpen(true);
            }
        }, 150);
        setOpenedFromNewPrdFlow(false); 
        return () => clearTimeout(timer);
      }
    }
  }, [openedFromNewPrdFlow, currentUser?.id]);

  const safeDateParse = (dateString: string | undefined): number => {
      if (!dateString) return 0;
      const parsed = new Date(dateString.replace(/\./g, '/').replace(/ /g, '')).getTime();
      return isNaN(parsed) ? 0 : parsed;
  }

  const visibleGroups = Object.entries(groupedPrds)
    .map(([documentId, prds]) => {
      const visiblePrds = prds.filter(prd => !hiddenItems.has(prd.id));
      if (selectedProject !== 'all' && (!visiblePrds[0] || visiblePrds[0].projectName !== selectedProject)) {
        return null;
      }
      return { documentId, prds: visiblePrds };
    })
    .filter((group): group is { documentId: string; prds: PrdDocument[] } => group !== null && group.prds.length > 0 && !hiddenItems.has(group.documentId))
    .sort((a, b) => {
        const aIsFavorite = a.prds[0]?.isFavorite ?? false;
        const bIsFavorite = b.prds[0]?.isFavorite ?? false;
        
        if (aIsFavorite !== bIsFavorite) {
            return aIsFavorite ? -1 : 1;
        }

        const dateA = safeDateParse(a.prds[0]?.updatedAt);
        const dateB = safeDateParse(b.prds[0]?.updatedAt);
        return dateB - dateA;
    });

  const totalItems = visibleGroups.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const paginatedGroups = visibleGroups.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  
  const currentProjectName = selectedProject === 'all' ? '전체보기' : projects.find(p => p.name === selectedProject)?.name || '전체보기';

  const NewPrdDialogContent = () => (
    <>
      <DialogHeader>
        <DialogTitle>새로운 PRD 생성</DialogTitle>
        <DialogDescription>
            PRD를 추가할 프로젝트를 선택해주세요.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
      <Label htmlFor="new-prd-project">프로젝트</Label>
      <Select 
          value={newPrdSelectedProjectName} 
          onValueChange={(value) => setNewPrdSelectedProjectName(value)}>
          <SelectTrigger id="new-prd-project">
          <SelectValue placeholder="프로젝트 선택" />
          </SelectTrigger>
          <SelectContent>
          {projects.map(p => (
              <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
          ))}
          </SelectContent>
      </Select>
      </div>
      <DialogFooter className='justify-between sm:justify-between'>
        <Button variant="outline" onClick={() => {
            setOpenedFromNewPrdFlow(true);
            setIsProjectManagementOpen(true);
            setIsNewPrdDialogOpen(false);
        }}>
          프로젝트 생성
        </Button>
        <Button onClick={() => createNewPrd(newPrdSelectedProjectName)}>작성 시작</Button>
      </DialogFooter>
    </>
  );

  if (!currentUser) {
    return null; 
  }
  
  return (
    <>
    <main className="prd-list-page min-h-screen bg-white no-print">


      <div className="prd-list-shell mb-page-gutter">
        <div className="prd-list-heading mb-4">
          <h1 className="mb-page-title">PRD</h1>
        </div>
        <div className="prd-list-toolbar flex justify-between items-center mb-4">
            <div className='prd-list-project-controls flex items-center gap-2'>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="prd-project-filter-trigger">
                    <span className="prd-project-filter-label">{currentProjectName}</span>
                    <ChevronDown className="ml-2 h-4 w-4"/>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" collisionPadding={12} className="prd-project-dropdown">
                  <DropdownMenuItem onClick={() => setSelectedProject('all')}>전체보기</DropdownMenuItem>
                  {projects.map(project => (
                    <DropdownMenuItem key={project.id} onClick={() => setSelectedProject(project.name)}>
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="icon" variant="ghost" onClick={() => setIsProjectManagementOpen(true)}>
                  <FolderKanban className="h-5 w-5"/>
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <FlowActionButton onClick={handleOpenNewPrdDialog}>
                  <Plus size={18} aria-hidden="true" />
                  PRD 작성하기
              </FlowActionButton>
            </div>
        </div>
        
        <Dialog open={isNewPrdDialogOpen} onOpenChange={setIsNewPrdDialogOpen}>
            <DialogContent className="prd-action-dialog" overlayClassName="prd-action-overlay" onOpenAutoFocus={(e) => e.preventDefault()}>
                <NewPrdDialogContent />
            </DialogContent>
        </Dialog>
        
        <FirstProjectDialogContent
          open={isFirstProjectDialogOpen}
          onOpenChange={setIsFirstProjectDialogOpen}
          value={firstProjectName}
          onChange={e => setFirstProjectName(e.target.value)}
          onSubmit={handleCreateFirstProjectAndPrd}
        />
        


        {stats.totalDocs > 0 && !isAdmin && (
            <div className="prd-list-summary mb-4 p-4 bg-blue-100 border border-blue-200 text-blue-800 rounded-lg flex items-start sm:items-center gap-3">
                <Info className="h-5 w-5 shrink-0 mt-1 sm:mt-0"/>
                <div>작성한 PRD <strong>{stats.totalDocs}개</strong>{!isMobile && <> · 평균 <strong>{stats.avgVersions}개</strong> 버전</>}</div>
            </div>
        )}

        <div className="prd-document-list space-y-4">
            {paginatedGroups.length > 0 ? (
            paginatedGroups.map(({ documentId, prds }) => {
                const latestVersion = prds[0];
                if (!latestVersion) return null;

                const isRestoring = justRestored.has(documentId);
                const isExpanded = expandedGroups.has(documentId);
                const versionsToShow = (prds.length > MAX_VERSIONS_VISIBLE && !isExpanded) ? prds.slice(0, MAX_VERSIONS_VISIBLE) : prds;

                const now = new Date().getTime();
                const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
                
                const createdAt = safeDateParse(latestVersion.createdAt);
                const updatedAt = safeDateParse(latestVersion.updatedAt);
                
                const isNew = prds.length === 1 && createdAt > fortyEightHoursAgo;
                const isUpdated = prds.length > 1 && updatedAt > fortyEightHoursAgo;
                
                const isAnimatingFavorite = justFavorited.has(documentId);
                const isAnimatingOut = animatingOut.has(documentId);

                return (
                <div key={documentId} className={cn("prd-document-row flex items-start gap-2",
                    isAnimatingFavorite && "animate-slide-in-from-bottom",
                    isAnimatingOut && "animate-slide-out-to-bottom",
                    isRestoring && "animate-slide-in")}>
                    <Card className="prd-document-card flex-grow">
                        <CardContent className="prd-document-content p-4">
                        <div className="flex justify-between items-start gap-2">
                            <div 
                            className="flex-grow cursor-pointer"
                            onClick={() => router.push(`/edit/${latestVersion.id}`)}
                            >
                            <h3 className="prd-document-title font-semibold text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary"/>
                                <span className="hover:underline">{latestVersion.title}</span>
                                {isNew && <Badge>NEW</Badge>}
                                {isUpdated && <Badge variant="secondary" style={{ backgroundColor: '#8B5CF6', color: 'white' }}>UPDATE</Badge>}
                            </h3>
                            <p className="prd-document-mission text-md text-gray-600 mt-1 truncate">{latestVersion.mission}</p>
                            <div className="prd-document-meta text-sm text-gray-500 mt-2">
                                {latestVersion.projectName && <Badge variant="outline" className="mr-2">{latestVersion.projectName}</Badge>}
                                총 {prds.length}개 버전
                            </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex items-center gap-2">
                                <div className='hidden sm:block'>
                                    <p className="text-sm text-gray-500 mb-2">
                                        업데이트: {latestVersion.updatedAt}
                                    </p>
                                    <Button onClick={() => createNewVersion(latestVersion)} size="sm" variant="outline">
                                        <GitBranchPlus className="mr-2 h-4 w-4" /> 새 버전
                                    </Button>
                                </div>
                                {isMobile && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => handleToggleFavorite(documentId)}>
                                                <Star className={cn("mr-2 h-4 w-4", latestVersion.isFavorite && "fill-current text-yellow-500")}/>
                                                <span>{latestVersion.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}</span>
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onSelect={() => handlePrintPrd(latestVersion)}>
                                                <FileDown className="mr-2 h-4 w-4"/>
                                                <span>PDF 내보내기</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => createNewVersion(latestVersion)}>
                                                <GitBranchPlus className="mr-2 h-4 w-4"/>
                                                <span>새 버전</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator/>
                                            <DropdownMenuItem onSelect={() => requestDeletePrd(latestVersion, true)} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4"/>
                                                <span>문서 삭제</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                        {isAdmin && <div className="mt-1"><Badge variant="secondary" className="text-xs">{`${latestVersion.author} - ${latestVersion.authorId}`}</Badge></div>}
                        <div className="prd-version-list mt-2 pl-4 border-l-2 ml-2">
                        {versionsToShow.map((prd, index) => {
                            const isRestoringItem = justRestored.has(prd.id);

                             return (
                            <div key={`${prd.id}-${index}`} className={cn("prd-version-row flex justify-between items-center text-sm group", isRestoringItem && 'animate-slide-in')}>
                                <div 
                                    className="prd-version-link flex-grow block py-1 px-2 rounded-md hover:bg-gray-100 cursor-pointer"
                                    onClick={() => router.push(`/edit/${prd.id}`)}
                                >
                                    <Badge variant="secondary" className="mr-2">v{prd.version}</Badge>
                                    <span className="prd-version-date text-gray-600">수정일: {prd.updatedAt}</span>
                                </div>
                                <div className="flex items-center opacity-0 group-hover:opacity-100">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8"
                                        onClick={() => handlePrintPrd(prd)}
                                    >
                                        <FileDown className="h-4 w-4 text-muted-foreground"/>
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8"
                                        onClick={() => requestDeletePrd(prd, false)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            </div>
                             )
                        })}
                        {prds.length > MAX_VERSIONS_VISIBLE && (
                            <div className="mt-2">
                                <Button variant="ghost" size="sm" className="w-full text-blue-600" onClick={() => toggleGroupExpansion(documentId)}>
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp className="mr-2 h-4 w-4"/> 숨기기
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="mr-2 h-4 w-4"/> {prds.length - MAX_VERSIONS_VISIBLE}개 버전 더보기
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                        </div>
                        </CardContent>
                    </Card>
                    {!isMobile && (
                      <div className="flex flex-col items-center mt-2 space-y-1">
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-muted-foreground hover:bg-yellow-100 hover:text-yellow-500"
                              onClick={() => handleToggleFavorite(documentId)}
                          >
                              <Star className={cn("h-5 w-5", latestVersion.isFavorite && "fill-current text-yellow-500")}/>
                          </Button>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-muted-foreground hover:bg-blue-100 hover:text-blue-500"
                              onClick={() => handlePrintPrd(latestVersion)}
                          >
                              <FileDown className="h-5 w-5"/>
                          </Button>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => requestDeletePrd(latestVersion, true)}
                          >
                              <Trash2 className="h-5 w-5"/>
                          </Button>
                      </div>
                    )}
                </div>
                )
            })
            ) : (
            <div className="prd-empty-state">
              <Search size={28} aria-hidden="true" />
              <h2 className="mb-card-title">작성된 PRD가 없습니다.</h2>
              <p>새 PRD를 작성하거나 다른 프로젝트를 선택해보세요.</p>
              <button type="button" onClick={handleOpenNewPrdDialog}>PRD 작성하기</button>
            </div>
            )}
        </div>
        
        {totalPages > 1 && (
            <div className="flex justify-end items-center gap-4 mt-4">
                <span className="text-sm text-muted-foreground">
                    {startItem}–{endItem} / {totalItems}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                    {currentPage}/{totalPages}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )}

      </div>

      {isMobile ? (
        <Sheet open={isDeleteDialogOpen || showFinalDeleteConfirm} onOpenChange={(isOpen) => !isOpen && closeDeleteDialog()}>
          <SheetContent side="bottom">
            {isDeleteDialogOpen && itemToDelete && (
              <>
                <SheetHeader>
                  <SheetTitle>삭제 확인</SheetTitle>
                  <SheetDescription>
                    v{itemToDelete?.item.version} 버전을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </SheetDescription>
                </SheetHeader>
                <SheetFooter className="grid grid-cols-2 gap-2 pt-4">
                   <Button onClick={closeDeleteDialog} variant="outline">취소</Button>
                   <Button onClick={confirmDelete} variant="destructive">삭제</Button>
                </SheetFooter>
              </>
            )}
            {showFinalDeleteConfirm && itemToDelete && (
               <>
                <SheetHeader>
                  <SheetTitle>최종 삭제 확인</SheetTitle>
                  <SheetDescription>
                    {itemToDelete?.isGroupDelete 
                    ? "이 문서와 관련된 모든 버전이 영구적으로 삭제됩니다. 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                    : "이 버전은 문서의 마지막 버전입니다. 삭제하면 문서 전체가 삭제됩니다. 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                    }
                  </SheetDescription>
                </SheetHeader>
                <SheetFooter className="grid grid-cols-2 gap-2 pt-4">
                   <Button onClick={closeDeleteDialog} variant="outline">취소</Button>
                   <Button onClick={confirmDelete} variant="destructive">영구 삭제</Button>
                </SheetFooter>
              </>
            )}
          </SheetContent>
        </Sheet>
      ) : (
        <>
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
              <AlertDialogHeader>
                <AlertDialogTitle>삭제 확인</AlertDialogTitle>
                <AlertDialogDescription>
                  v{itemToDelete?.item.version} 버전을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDeleteDialog}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={showFinalDeleteConfirm} onOpenChange={setShowFinalDeleteConfirm}>
            <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
               <AlertDialogHeader>
                <AlertDialogTitle>최종 삭제 확인</AlertDialogTitle>
                <AlertDialogDescription>
                  {itemToDelete?.isGroupDelete 
                    ? "이 문서와 관련된 모든 버전이 영구적으로 삭제됩니다. 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                    : "이 버전은 문서의 마지막 버전입니다. 삭제하면 문서 전체가 삭제됩니다. 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDeleteDialog}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">영구 삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      
      {isMobile ? (
        <Sheet open={!!projectToDelete} onOpenChange={(isOpen) => !isOpen && setProjectToDelete(null)}>
           <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>프로젝트 삭제 확인</SheetTitle>
                <SheetDescription>
                   {`"${projectToDelete?.name}" 프로젝트를 정말 삭제하시겠습니까? 해당 프로젝트에 속한 모든 PRD는 '미지정' 상태가 됩니다. 이 작업은 되돌릴 수 없습니다.`}
                </SheetDescription>
              </SheetHeader>
               <SheetFooter className="grid grid-cols-2 gap-2 pt-4">
                <Button onClick={() => setProjectToDelete(null)} variant="outline">취소</Button>
                <Button onClick={() => {
                    if (projectToDelete) handleDeleteProject(projectToDelete);
                    setProjectToDelete(null);
                }} variant="destructive">삭제</Button>
              </SheetFooter>
           </SheetContent>
        </Sheet>
      ) : (
        <AlertDialog open={!!projectToDelete} onOpenChange={(isOpen) => !isOpen && setProjectToDelete(null)}>
          <AlertDialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
            <AlertDialogHeader>
              <AlertDialogTitle>프로젝트 삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>
                {`"${projectToDelete?.name}" 프로젝트를 정말 삭제하시겠습니까? 해당 프로젝트에 속한 모든 PRD는 '미지정' 상태가 됩니다. 이 작업은 되돌릴 수 없습니다.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setProjectToDelete(null)}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    if (projectToDelete) handleDeleteProject(projectToDelete);
                    setProjectToDelete(null);
                }} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}


      <Dialog open={isProjectManagementOpen} onOpenChange={handleProjectManagementOpenChange}>
        <DialogContent className="prd-action-dialog max-w-md" overlayClassName="prd-action-overlay" onOpenAutoFocus={(e) => e.preventDefault()}>
          <ProjectManagementDialogContent
            projects={projects}
            hiddenProjects={hiddenProjects}
            justRestoredProjects={justRestoredProjects}
            editingProjectId={editingProjectId}
            editingProjectName={editingProjectName}
            setEditingProjectName={setEditingProjectName}
            onUpdateProjectName={handleUpdateProjectName}
            onEditProject={handleEditProject}
            onCancelEdit={handleCancelEdit}
            onSetProjectToDelete={setProjectToDelete}
            newProjectName={newProjectName}
            onNewProjectNameChange={(e) => setNewProjectName(e.target.value)}
            onAddNewProject={handleAddNewProject}
          />
        </DialogContent>
      </Dialog>
    </main>
    <div className="print-only">
        {prdToPrint && <PrdPreview prdData={prdToPrint} />}
    </div>
    </>
  );
}

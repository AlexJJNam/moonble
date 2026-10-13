

export interface PrdDocument {
  id: string;
  documentId: string; // All versions of a document share this
  parentId?: string; // The id of the prd this was based on
  title: string;
  mission: string;
  author: string;
  authorId: string; // The id of the author
  version: string;
  createdAt: string;
  updatedAt: string;
  
  projectName?: string; // Project assignment
  isFavorite?: boolean; // To mark as favorite

  background: string;
  goals: string[];
  targetUser: string;
  successMetrics: string[];
  
  scopeIn: string[];
  scopeOut: string[];
  assumptions: string[];
  dependencies: string[];
  risks: string[];
  
  userStories: { asA: string; iWant: string; soThat: string }[];
  flowSummary: string;
  acceptanceCriteria: string[];
  
  requirements: {
    type: 'functional' | 'non-functional';
    priority: 'Must' | 'Should' | 'Could' | 'Won\'t';
    text: string;
  }[];

  milestones: { name: string; date: string; owner: string }[];
  stakeholders: string[];
  
  northStarMetric: string;
  analyticsEvents: { event: string; definition: string }[];
  abTests: { hypothesis: string; metric: string }[];

  tags: string[];
  versionNotes: string;
  references: { label: string; url:string }[];

  companyLogoUrl?: string;
  companyName?: string;
}


export interface User {
  id: string;
  name?: string;
  companyName?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
}

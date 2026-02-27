import { apiClient } from './client';

export interface SkillCategory {
  id: string;
  name: string;
  description: string;
  skillCount: number;
  agent: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  agent: string;
  parameters: SkillParameter[];
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  required: boolean;
  description: string;
  default?: string;
  options?: string[];
}

export interface SkillExecutionResult {
  ok: boolean;
  executionId: string;
  output: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

export const skillsApi = {
  async getCategories(): Promise<SkillCategory[]> {
    const result = await apiClient.get<SkillCategory[] | { items?: SkillCategory[] }>('/api/skills');
    return Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []);
  },

  async getByCategory(category: string): Promise<Skill[]> {
    const result = await apiClient.get<Skill[] | { items?: Skill[] }>(`/api/skills?category=${encodeURIComponent(category)}`);
    return Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []);
  },

  async getById(skillId: string): Promise<Skill> {
    return apiClient.get(`/api/skills/${encodeURIComponent(skillId)}`);
  },

  async execute(skillId: string, params: Record<string, unknown>): Promise<SkillExecutionResult> {
    return apiClient.post(`/api/skills/${encodeURIComponent(skillId)}/execute`, params);
  },
};

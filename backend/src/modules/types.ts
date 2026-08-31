export interface ModuleMetadata {
  name: string;
  description: string;
  version: string;
  status: 'planned' | 'in_development' | 'active';
}

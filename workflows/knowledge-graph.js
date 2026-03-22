#!/usr/bin/env node

/**
 * Centralized Knowledge Graph
 * Stores all recon data, findings, and relationships
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = process.env.HARBINGER_WORKSPACE || path.join(require('os').homedir(), '.harbinger/workspace');
const CONFIG = {
  GRAPH_DIR: path.join(WORKSPACE, 'knowledge-graph'),
  GRAPH_FILE: path.join(WORKSPACE, 'knowledge-graph/graph.json'),
  ENTITIES_FILE: path.join(WORKSPACE, 'knowledge-graph/entities.json'),
  RELATIONS_FILE: path.join(WORKSPACE, 'knowledge-graph/relations.json')
};

// Ensure directory exists
if (!fs.existsSync(CONFIG.GRAPH_DIR)) {
  fs.mkdirSync(CONFIG.GRAPH_DIR, { recursive: true });
}

/**
 * Knowledge Graph Class
 */
class KnowledgeGraph {
  constructor() {
    this.entities = new Map();
    this.relations = new Map();
    this.load();
  }
  
  /**
   * Load graph from disk
   */
  load() {
    try {
      // Load entities
      if (fs.existsSync(CONFIG.ENTITIES_FILE)) {
        try {
          const entitiesData = JSON.parse(fs.readFileSync(CONFIG.ENTITIES_FILE, 'utf8'));
          entitiesData.forEach(e => this.entities.set(e.id, e));
        } catch (e) {
          console.error('[GRAPH] Malformed entities file:', e.message);
        }
      }

      // Load relations
      if (fs.existsSync(CONFIG.RELATIONS_FILE)) {
        try {
          const relationsData = JSON.parse(fs.readFileSync(CONFIG.RELATIONS_FILE, 'utf8'));
          relationsData.forEach(r => this.relations.set(r.id, r));
        } catch (e) {
          console.error('[GRAPH] Malformed relations file:', e.message);
        }
      }
      
      console.log(`[GRAPH] Loaded ${this.entities.size} entities, ${this.relations.size} relations`);
      
    } catch (error) {
      console.error('[ERROR] Failed to load graph:', error.message);
    }
  }
  
  /**
   * Save graph to disk
   */
  save() {
    try {
      // Save entities
      fs.writeFileSync(
        CONFIG.ENTITIES_FILE,
        JSON.stringify(Array.from(this.entities.values()), null, 2)
      );
      
      // Save relations
      fs.writeFileSync(
        CONFIG.RELATIONS_FILE,
        JSON.stringify(Array.from(this.relations.values()), null, 2)
      );
      
      // Save unified graph
      fs.writeFileSync(
        CONFIG.GRAPH_FILE,
        JSON.stringify({
          entities: Array.from(this.entities.values()),
          relations: Array.from(this.relations.values()),
          lastUpdated: Date.now()
        }, null, 2)
      );
      
      console.log(`[GRAPH] Saved ${this.entities.size} entities, ${this.relations.size} relations`);
      
    } catch (error) {
      console.error('[ERROR] Failed to save graph:', error.message);
    }
  }
  
  /**
   * Create a new entity
   */
  createEntity(type, data) {
    const id = `${type}:${data.id || Date.now()}`;
    const entity = {
      id,
      type,
      ...data,
      createdAt: Date.now()
    };
    
    this.entities.set(id, entity);
    console.log(`[GRAPH] Created entity: ${id} (${type})`);
    return id;
  }
  
  /**
   * Update an existing entity
   */
  updateEntity(id, data) {
    if (this.entities.has(id)) {
      const existing = this.entities.get(id);
      this.entities.set(id, { ...existing, ...data, updatedAt: Date.now() });
      console.log(`[GRAPH] Updated entity: ${id}`);
      return true;
    }
    return false;
  }
  
  /**
   * Delete an entity and its relations
   */
  deleteEntity(id) {
    this.entities.delete(id);
    
    // Remove all relations involving this entity
    for (const [relId, rel] of this.relations) {
      if (rel.from === id || rel.to === id) {
        this.relations.delete(relId);
      }
    }
    
    console.log(`[GRAPH] Deleted entity: ${id}`);
  }
  
  /**
   * Create a relation between two entities
   */
  createRelation(fromId, toId, type, data = {}) {
    const id = `${fromId}:${type}:${toId}`;
    const relation = {
      id,
      from: fromId,
      to: toId,
      type,
      ...data,
      createdAt: Date.now()
    };
    
    this.relations.set(id, relation);
    console.log(`[GRAPH] Created relation: ${id}`);
    return id;
  }
  
  /**
   * Get all entities of a specific type
   */
  getEntitiesByType(type) {
    return Array.from(this.entities.values())
      .filter(e => e.type === type);
  }
  
  /**
   * Get entity by ID
   */
  getEntity(id) {
    return this.entities.get(id);
  }
  
  /**
   * Search entities by query
   */
  searchEntities(query) {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.entities.values())
      .filter(e => 
        Object.entries(e)
          .some(([key, value]) => 
            key !== 'id' && 
            String(value).toLowerCase().includes(lowerQuery)
          )
      );
  }
  
  /**
   * Get all relations for an entity
   */
  getRelations(entityId) {
    return Array.from(this.relations.values())
      .filter(r => r.from === entityId || r.to === entityId);
  }
  
  /**
   * Find CVEs affecting a target
   */
  findCVEsForTarget(targetId) {
    const relations = this.getRelations(targetId);
    const cveRelations = relations.filter(r => r.type === 'AFFECTED_BY_CVE');
    const cveIds = cveRelations.map(r => r.to);
    
    return cveIds.map(id => this.getEntity(id)).filter(Boolean);
  }
  
  /**
   * Get target statistics
   */
  getTargetStats(targetId) {
    const target = this.getEntity(targetId);
    if (!target || target.type !== 'target') {
      return null;
    }
    
    const subdomains = this.getEntitiesByType('subdomain')
      .filter(s => s.targetId === targetId);
    
    const cves = this.findCVEsForTarget(targetId);
    const findings = this.getEntitiesByType('finding')
      .filter(f => f.targetId === targetId);
    
    return {
      target: target,
      subdomainCount: subdomains.length,
      cveCount: cves.length,
      findingCount: findings.length,
      criticalCVEs: cves.filter(c => c.severity === 'CRITICAL').length,
      highCVEs: cves.filter(c => c.severity === 'HIGH').length
    };
  }
  
  /**
   * Export graph for dashboard
   */
  exportForDashboard() {
    const targets = this.getEntitiesByType('target');
    
    return {
      targets: targets.map(t => this.getTargetStats(t.id)),
      totalCVEs: this.getEntitiesByType('cve').length,
      totalFindings: this.getEntitiesByType('finding').length,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Get graph summary
   */
  getSummary() {
    return {
      entities: {
        total: this.entities.size,
        byType: {
          target: this.getEntitiesByType('target').length,
          subdomain: this.getEntitiesByType('subdomain').length,
          cve: this.getEntitiesByType('cve').length,
          finding: this.getEntitiesByType('finding').length
        }
      },
      relations: {
        total: this.relations.size,
        byType: {
          SUBDOMAIN_OF: this.relationCountByType('SUBDOMAIN_OF'),
          AFFECTED_BY_CVE: this.relationCountByType('AFFECTED_BY_CVE'),
          HAS_FINDING: this.relationCountByType('HAS_FINDING')
        }
      },
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Get relation count by type
   */
  relationCountByType(type) {
    return Array.from(this.relations.values())
      .filter(r => r.type === type).length;
  }
}

/**
 * Initialize graph with target data
 */
function initializeTargets(graph) {
  const targets = [
    { id: 'vodafone-oman', name: 'Vodafone Oman', domain: 'vodafone.om', program: 'HackerOne' },
    { id: 'city-vienna', name: 'City of Vienna', domain: 'wien.gv.at', program: 'Bugcrowd' },
    { id: 'jora', name: 'Jora', domain: 'jora.com', program: 'Bugcrowd' }
  ];
  
  for (const target of targets) {
    if (!graph.getEntity(`target:${target.id}`)) {
      graph.createEntity('target', target);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('[GRAPH] Initializing knowledge graph...\n');
  
  const graph = new KnowledgeGraph();
  
  // Initialize targets if needed
  initializeTargets(graph);
  
  // Save graph
  graph.save();
  
  // Display summary
  const summary = graph.getSummary();
  console.log('\n[GRAPH] Graph Summary:');
  console.log(`  Entities: ${summary.entities.total}`);
  console.log(`  Relations: ${summary.relations.total}`);
  console.log(`  Targets: ${summary.entities.byType.target}`);
  console.log(`  CVEs: ${summary.entities.byType.cve}`);
  console.log(`  Findings: ${summary.entities.byType.finding}`);
  
  // Export for dashboard
  const dashboardData = graph.exportForDashboard();
  console.log('\n[GRAPH] Dashboard data exported');
  
  return graph;
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('[FATAL]', error);
      process.exit(1);
    });
}

module.exports = { KnowledgeGraph, initializeTargets };
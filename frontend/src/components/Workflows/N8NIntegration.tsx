import React, { useState, useEffect } from 'react';
import { listWorkflows, triggerWorkflow, getExecutionStatus } from '../../api/n8n';

interface N8NIntegrationProps {
  n8nInstanceUrl: string;
}

const N8NIntegration: React.FC<N8NIntegrationProps> = ({ n8nInstanceUrl }) => {
  const [isN8NRunning, setIsN8NRunning] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkN8NStatus = async () => {
      try {
        // A simple check to see if n8n is reachable
        const response = await fetch(`${n8nInstanceUrl}/healthz`);
        setIsN8NRunning(response.ok);
      } catch (err) {
        setIsN8NRunning(false);
      }
    };

    const fetchWorkflows = async () => {
      setLoading(true);
      try {
        const data = await listWorkflows();
        setWorkflows(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch workflows');
      } finally {
        setLoading(false);
      }
    };

    checkN8NStatus();
    fetchWorkflows();

    const interval = setInterval(() => {
      checkN8NStatus();
      fetchWorkflows();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [n8nInstanceUrl]);

  const handleTriggerWorkflow = async (workflowId: string) => {
    try {
      await triggerWorkflow(workflowId);
      alert('Workflow triggered successfully!');
    } catch (err: any) {
      alert(`Failed to trigger workflow: ${err.message}`);
    }
  };

  if (loading) return <div>Loading n8n integration...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="n8n-integration-container p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">n8n Workflow Automation</h2>

      <div className="status-indicator mb-4">
        Status: <span className={`font-bold ${isN8NRunning ? 'text-green-500' : 'text-red-500'}`}>
          {isN8NRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      <div className="n8n-iframe-link mb-4">
        <p>Access your n8n instance directly:</p>
        <a href={n8nInstanceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Open n8n Interface
        </a>
        {/* Optionally embed as iframe */}
        {/* <iframe src={n8nInstanceUrl} width="100%" height="600px" title="n8n Instance"></iframe> */}
      </div>

      <div className="quick-actions mb-4">
        <h3 className="text-lg font-medium mb-2">Quick Actions</h3>
        <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2 hover:bg-blue-600">
          Import Workflow (Manual)
        </button>
        <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
          Refresh Workflows
        </button>
      </div>

      <div className="workflow-list mb-4">
        <h3 className="text-lg font-medium mb-2">Available Workflows</h3>
        {workflows.length === 0 ? (
          <p>No workflows found. Please import some or check n8n status.</p>
        ) : (
          <ul>
            {workflows.map((workflow) => (
              <li key={workflow.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                <span>{workflow.name}</span>
                <button
                  onClick={() => handleTriggerWorkflow(workflow.id)}
                  className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
                >
                  Trigger
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="workflow-templates-gallery">
        <h3 className="text-lg font-medium mb-2">Pre-built Workflow Templates</h3>
        <p>Browse and import our curated workflow templates for common security tasks:</p>
        {/* This would ideally link to a gallery or provide direct import functionality */}
        <ul>
          <li>Continuous Reconnaissance</li>
          <li>CVE Monitoring</li>
          <li>Automated Reporting</li>
          <li>Target Discovery</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">Refer to `n8n/README.md` for manual import instructions.</p>
      </div>
    </div>
  );
};

export default N8NIntegration;

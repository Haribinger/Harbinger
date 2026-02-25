const N8N_API_BASE_URL = process.env.N8N_API_BASE_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || 'YOUR_N8N_API_KEY'; // Replace with actual API key or use environment variable

const headers = {
  'Content-Type': 'application/json',
  'X-N8N-API-KEY': N8N_API_KEY,
  // For basic auth, you might need to encode username and password
  // 'Authorization': 'Basic ' + btoa(`${process.env.N8N_USER}:${process.env.N8N_PASS}`),
};

export const listWorkflows = async () => {
  try {
    const response = await fetch(`${N8N_API_BASE_URL}/workflows`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.data; // n8n API often returns data in a 'data' field
  } catch (error) {
    console.error("Error listing workflows:", error);
    throw error;
  }
};

export const triggerWorkflow = async (workflowId: string, data?: any) => {
  try {
    const response = await fetch(`${N8N_API_BASE_URL}/workflows/${workflowId}/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error triggering workflow ${workflowId}:`, error);
    throw error;
  }
};

export const getExecutionStatus = async (executionId: string) => {
  try {
    const response = await fetch(`${N8N_API_BASE_URL}/executions/${executionId}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Error getting execution status for ${executionId}:`, error);
    throw error;
  }
};

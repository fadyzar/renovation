import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisRequest {
  description: string;
  work_types: string[];
  budget_min?: number;
  budget_max?: number;
  images?: string[];
}

interface AnalysisResponse {
  complexity: string;
  estimated_cost: number;
  timeline_weeks: number;
  detected_work_types: string[];
  risk_factors: string[];
  recommendations: string[];
  confidence_score: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const data: AnalysisRequest = await req.json();

    const analysis: AnalysisResponse = {
      complexity: analyzeComplexity(data.work_types, data.description),
      estimated_cost: estimateCost(data.work_types, data.budget_min, data.budget_max),
      timeline_weeks: estimateTimeline(data.work_types, data.description),
      detected_work_types: data.work_types,
      risk_factors: identifyRisks(data.description, data.work_types),
      recommendations: generateRecommendations(data.work_types, data.description),
      confidence_score: 0.85,
    };

    return new Response(JSON.stringify(analysis), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to analyze project" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

function analyzeComplexity(workTypes: string[], description: string): string {
  const complexityScore = workTypes.length * 10 + (description.length > 200 ? 20 : 0);

  if (complexityScore < 30) return "Low";
  if (complexityScore < 60) return "Medium";
  return "High";
}

function estimateCost(
  workTypes: string[],
  budgetMin?: number,
  budgetMax?: number
): number {
  if (budgetMin && budgetMax) {
    return (budgetMin + budgetMax) / 2;
  }

  const baseCosts: Record<string, number> = {
    electrical: 5000,
    plumbing: 4000,
    painting: 2000,
    flooring: 6000,
    roofing: 8000,
    "kitchen remodel": 15000,
    "bathroom remodel": 10000,
    hvac: 7000,
    landscaping: 3000,
    carpentry: 4000,
    drywall: 3000,
    "windows & doors": 5000,
  };

  let totalCost = 0;
  workTypes.forEach((type) => {
    const normalizedType = type.toLowerCase();
    totalCost += baseCosts[normalizedType] || 3000;
  });

  return Math.round(totalCost * 1.2);
}

function estimateTimeline(workTypes: string[], description: string): number {
  const baseWeeks: Record<string, number> = {
    electrical: 1,
    plumbing: 1.5,
    painting: 1,
    flooring: 2,
    roofing: 2,
    "kitchen remodel": 4,
    "bathroom remodel": 3,
    hvac: 1,
    landscaping: 2,
    carpentry: 2,
    drywall: 1,
    "windows & doors": 1.5,
  };

  let totalWeeks = 0;
  workTypes.forEach((type) => {
    const normalizedType = type.toLowerCase();
    totalWeeks += baseWeeks[normalizedType] || 1;
  });

  const complexityMultiplier = description.length > 300 ? 1.3 : 1;
  return Math.ceil(totalWeeks * complexityMultiplier);
}

function identifyRisks(description: string, workTypes: string[]): string[] {
  const risks: string[] = [];
  const lowerDescription = description.toLowerCase();

  if (lowerDescription.includes("old") || lowerDescription.includes("vintage")) {
    risks.push("Potential asbestos or lead paint in older structures");
  }

  if (workTypes.some((t) => t.toLowerCase().includes("electrical"))) {
    risks.push("Electrical work requires licensed professional and permits");
  }

  if (workTypes.some((t) => t.toLowerCase().includes("plumbing"))) {
    risks.push("Plumbing modifications may require inspection");
  }

  if (workTypes.some((t) => t.toLowerCase().includes("roofing"))) {
    risks.push("Weather-dependent timeline");
  }

  if (workTypes.length > 5) {
    risks.push("Multiple work types may extend timeline");
  }

  if (risks.length === 0) {
    risks.push("No major risks identified");
  }

  return risks;
}

function generateRecommendations(
  workTypes: string[],
  description: string
): string[] {
  const recommendations: string[] = [];

  if (workTypes.some((t) => t.toLowerCase().includes("kitchen"))) {
    recommendations.push(
      "Consider selecting appliances before starting to ensure proper measurements"
    );
  }

  if (workTypes.some((t) => t.toLowerCase().includes("bathroom"))) {
    recommendations.push(
      "Plan for alternative bathroom facilities during renovation"
    );
  }

  if (workTypes.length > 3) {
    recommendations.push(
      "Consider phased approach to manage budget and timeline"
    );
  }

  recommendations.push("Obtain multiple quotes for comparison");
  recommendations.push("Verify contractor licensing and insurance");

  return recommendations;
}

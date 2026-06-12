import os
import sys
import json
import argparse
from pathlib import Path
from pydantic import BaseModel, Field

# Define the Pydantic schema for structured output validation
class JobDescription(BaseModel):
    job_title: str = Field(..., description="Professional title of the job opening, e.g. 'Senior React Developer'")
    department: str = Field(..., description="Department name, e.g. 'Engineering' or 'Human Resources'")
    location: str = Field(..., description="Job location matching standard formats, e.g. 'Bangalore, India / Remote' or 'Chennai, India / Hybrid'")
    experience_required: str = Field(..., description="Years of experience required, e.g. '2+ Years' or '5-8 Years'")
    salary_range: str = Field(..., description="Estimated salary range in appropriate currency, e.g. '₹8,00,000 - ₹12,00,000 / year'")
    skills_required: str = Field(..., description="Comma-separated list of key technical or soft skills, e.g. 'React, Redux, JavaScript, CSS3'")
    responsibilities: str = Field(..., description="Bullet points detailing the responsibilities for this role, each responsibility on a new line starting with a hyphen, e.g. '- Build component libraries.'")
    benefits: str = Field(..., description="Bullet points detailing the perks and benefits of the role, each benefit on a new line starting with a hyphen, e.g. '- Medical coverage.'")

def load_env():
    """Load environment variables from the parent project's .env file if not already set."""
    if os.environ.get("GROQ_API_KEY"):
        return
    try:
        script_dir = Path(__file__).resolve().parent
        # backend/.env is located 3 directories up from backend/src/services/recruitment/
        env_path = script_dir.parents[2] / ".env"
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        v = v.strip().strip('"').strip("'")
                        os.environ[k.strip()] = v
    except Exception as e:
        print(f"Warning: Failed to load .env file: {e}", file=sys.stderr)

def main():
    # Force stdout/stderr to use UTF-8 to avoid UnicodeEncodeError on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Generate AI Job Description using Groq and Pydantic validation.")
    parser.add_argument("--role-prompt", required=True, help="User's prompt or role name to generate job description for")
    
    args = parser.parse_args()
    
    load_env()
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print(json.dumps({"error": "GROQ_API_KEY is not set in environment or .env file."}))
        sys.exit(1)
        
    model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
    
    system_prompt = (
        "You are an expert recruitment and hiring assistant. "
        "Your task is to generate a complete, professional, and detailed job description based on the user's role query. "
        "You must respond with a strict JSON object that conforms to the requested JSON schema. "
        "Ensure the response is extremely clean, professional, and directly matches the user's requested role details. "
        "No preamble, no conversational text, only the raw JSON payload."
    )
    
    user_prompt = f"""
Generate a structured job description for the following role request:
"{args.role_prompt}"

=== EXPECTED JSON SCHEMA STRUCTURE ===
Your JSON response must contain these fields:
- "job_title": (string) Professional title of the job.
- "department": (string) Department name (e.g. Engineering, Sales, Marketing, HR, Finance).
- "location": (string) Suggested location and work style, e.g. "Bangalore, India / Remote" or "Chennai, India / Hybrid".
- "experience_required": (string) Suggested experience level, e.g., "2+ Years" or "5-8 Years".
- "salary_range": (string) Standard salary package estimation, e.g. "₹8,00,000 - ₹12,00,000 / year".
- "skills_required": (string) Comma-separated list of skills.
- "responsibilities": (string) Detailed list of job responsibilities, with each item on a new line starting with a hyphen.
- "benefits": (string) Detailed list of company perks/benefits, with each item on a new line starting with a hyphen.

Generate the job description now in strict JSON format:
"""

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("Groq returned an empty response.")
            
        # Parse and validate the response against the Pydantic schema
        validated_jd = JobDescription.model_validate_json(raw_content)
        
        # Output the valid JSON structure to stdout
        print(validated_jd.model_dump_json())
        
    except Exception as e:
        print(json.dumps({"error": f"AI JD generation or validation failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()

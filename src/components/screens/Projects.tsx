import { useAuth } from '../../contexts/AuthContext';
import { MyProjects } from '../owner/MyProjects';
import { ProjectFeed } from '../contractor/ProjectFeed';

function Projects() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile.role === 'owner') {
    return <MyProjects />;
  }

  return <ProjectFeed />;
}

export default Projects;

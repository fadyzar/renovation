import { useAuth } from '../../contexts/AuthContext';
import { ContractorProfile } from '../contractor/ContractorProfile';
import { OwnerProfile } from '../owner/OwnerProfile';

function Profile() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {profile.role === 'contractor' ? (
        <ContractorProfile />
      ) : (
        <OwnerProfile />
      )}
    </div>
  );
}

export default Profile;

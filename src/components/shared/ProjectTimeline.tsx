import { CheckCircle, Clock, AlertCircle, DollarSign, Hammer, Trophy, Hourglass } from 'lucide-react';

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
  icon: any;
  timestamp?: string;
}

interface ProjectTimelineProps {
  projectStatus: string;
  selectedContractorName?: string;
  depositPaid?: boolean;
  startedAt?: string;
  completedAt?: string;
}

export function ProjectTimeline({
  projectStatus,
  selectedContractorName,
  depositPaid,
  startedAt,
  completedAt,
}: ProjectTimelineProps) {
  const steps: TimelineStep[] = [
    {
      id: 'created',
      title: 'Project Created',
      description: 'You created your renovation project',
      status: projectStatus === 'draft' ? 'current' : 'completed',
      icon: CheckCircle,
    },
    {
      id: 'published',
      title: 'Published to Contractors',
      description: 'Your project is visible to verified contractors',
      status:
        projectStatus === 'draft' ? 'pending' :
        projectStatus === 'seeking_quotes' ? 'current' : 'completed',
      icon: Clock,
    },
    {
      id: 'bids',
      title: 'Receiving Bids',
      description: 'Contractors submit their proposals',
      status:
        projectStatus === 'draft' ? 'pending' :
        projectStatus === 'seeking_quotes' ? 'current' : 'completed',
      icon: Hammer,
    },
    {
      id: 'selected',
      title: 'Contractor Selected',
      description: selectedContractorName
        ? `You selected ${selectedContractorName}`
        : 'Select a contractor to proceed',
      status:
        projectStatus === 'draft' || projectStatus === 'seeking_quotes' ? 'pending' :
        projectStatus === 'awaiting_deposit' ? 'current' : 'completed',
      icon: CheckCircle,
    },
    {
      id: 'deposit',
      title: 'Security Deposit',
      description: depositPaid
        ? 'Contractor paid 10% security deposit'
        : 'Waiting for contractor to pay security deposit',
      status:
        projectStatus === 'draft' || projectStatus === 'seeking_quotes' ? 'pending' :
        projectStatus === 'awaiting_deposit' ? 'current' : 'completed',
      icon: DollarSign,
      timestamp: depositPaid && startedAt ? startedAt : undefined,
    },
    {
      id: 'progress',
      title: 'Work In Progress',
      description: 'Contractor is working on your project',
      status:
        projectStatus === 'in_progress' ? 'current' :
        projectStatus === 'completed' ? 'completed' : 'pending',
      icon: Hammer,
      timestamp: startedAt,
    },
    {
      id: 'completed',
      title: 'Project Completed',
      description: 'Work finished and approved',
      status: projectStatus === 'completed' ? 'completed' : 'pending',
      icon: Trophy,
      timestamp: completedAt,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-300';
      case 'current':
        return 'text-blue-600 bg-blue-100 border-blue-300';
      default:
        return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  const getConnectorColor = (step: TimelineStep, index: number) => {
    if (step.status === 'completed') return 'bg-green-500';
    if (step.status === 'current' && index > 0 && steps[index - 1].status === 'completed') {
      return 'bg-gradient-to-b from-green-500 to-gray-300';
    }
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Project Timeline</h3>

      <div className="relative">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="relative">
              {!isLast && (
                <div
                  className={`absolute left-[19px] top-[40px] w-0.5 h-full ${getConnectorColor(step, index)}`}
                  style={{ height: 'calc(100% + 16px)' }}
                />
              )}

              <div className="flex items-start gap-4 pb-8">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center relative z-10 ${getStatusColor(
                    step.status
                  )}`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className={`font-semibold ${
                        step.status === 'completed' ? 'text-gray-900' :
                        step.status === 'current' ? 'text-blue-900' :
                        'text-gray-500'
                      }`}>
                        {step.title}
                      </h4>
                      <p className={`text-sm mt-0.5 ${
                        step.status === 'pending' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {step.description}
                      </p>
                    </div>

                    {step.timestamp && (
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(step.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {step.status === 'current' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
                      <Hourglass className="w-4 h-4 animate-pulse" />
                      <span className="font-medium">In Progress</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {projectStatus === 'cancelled' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Project Cancelled</p>
              <p className="text-sm text-red-700 mt-0.5">
                This project was cancelled and is no longer active.
              </p>
            </div>
          </div>
        </div>
      )}

      {projectStatus === 'disputed' && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Project Disputed</p>
              <p className="text-sm text-amber-700 mt-0.5">
                There is an active dispute on this project. Our team is reviewing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
